-- =============================================================================
-- StockLeague : schéma initial
-- -----------------------------------------------------------------------------
-- Principes :
--   * Tous les montants sont en numeric (jamais de float) : pas d'erreur d'arrondi.
--   * Row Level Security (RLS) activée sur TOUTES les tables. Un joueur ne lit
--     que les données des ligues dont il est membre.
--   * Aucune écriture directe depuis le navigateur sur les tables de jeu :
--     tout passe par des fonctions Postgres "security definer" (RPC) qui
--     vérifient les règles de façon atomique. Seul le profil est modifiable
--     directement (pseudo, avatar).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.league_status   as enum ('draft', 'active', 'finished');
create type public.member_role     as enum ('admin', 'member');
create type public.trade_side      as enum ('buy', 'sell');
create type public.earnings_timing as enum ('bmo', 'amc', 'unknown'); -- avant ouverture / après clôture / inconnu
create type public.event_status    as enum ('scheduled', 'resolved', 'void');
create type public.prediction_choice as enum ('beat', 'miss');
create type public.prediction_confidence as enum ('normal', 'sure');
create type public.prediction_outcome as enum ('pending', 'correct', 'wrong', 'void');
create type public.points_source   as enum ('portfolio', 'prediction', 'streak', 'adjustment');

-- -----------------------------------------------------------------------------
-- Profils (1 ligne par utilisateur Supabase Auth)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  pseudo      text not null check (char_length(pseudo) between 2 and 24),
  avatar_url  text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Ligues
-- -----------------------------------------------------------------------------
create table public.leagues (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 3 and 40),
  invite_code      text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  invite_token     uuid not null unique default gen_random_uuid(), -- lien d'invitation
  owner_id         uuid not null references public.profiles (id),
  starting_cash    numeric(14,2) not null default 10000 check (starting_cash between 100 and 10000000),
  start_date       date not null,
  end_date         date not null,
  markets          text[] not null default '{US}',
  fee              numeric(10,2) not null default 0 check (fee >= 0 and fee <= 1000),
  max_players      int not null default 10 check (max_players between 2 and 50),
  allow_late_join  boolean not null default false,
  status           public.league_status not null default 'draft',
  season           int not null default 1 check (season >= 1),
  previous_league_id uuid references public.leagues (id) on delete set null,
  visibility       text not null default 'private' check (visibility in ('private', 'public')), -- futur : ligues publiques
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  finished_at      timestamptz,
  check (end_date > start_date),
  check (markets <@ array['US', 'TSX']::text[] and cardinality(markets) >= 1)
);
create index leagues_owner_idx on public.leagues (owner_id);
create index leagues_status_idx on public.leagues (status);

create table public.league_members (
  league_id  uuid not null references public.leagues (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null default 'member',
  cash       numeric(14,2) not null check (cash >= 0), -- pas de levier : jamais négatif
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index league_members_user_idx on public.league_members (user_id);

-- -----------------------------------------------------------------------------
-- Portefeuille
-- -----------------------------------------------------------------------------
create table public.holdings (
  league_id  uuid not null,
  user_id    uuid not null,
  ticker     text not null check (ticker ~ '^[A-Z0-9.\-]{1,12}$'),
  quantity   numeric(14,2) not null check (quantity > 0), -- pas de vente à découvert
  avg_cost   numeric(14,4) not null check (avg_cost >= 0),
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id, ticker),
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);

create table public.transactions (
  id          bigint generated always as identity primary key,
  league_id   uuid not null,
  user_id     uuid not null,
  ticker      text not null,
  side        public.trade_side not null,
  order_type  text not null default 'market' check (order_type in ('market', 'limit')), -- futur : ordres à cours limité
  quantity    numeric(14,2) not null check (quantity > 0),
  price       numeric(14,4) not null check (price > 0),
  fee         numeric(10,2) not null default 0,
  cash_after  numeric(14,2) not null,
  market_open boolean not null,
  executed_at timestamptz not null default now(),
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);
create index transactions_league_user_idx on public.transactions (league_id, user_id, executed_at desc);

create table public.portfolio_snapshots (
  league_id    uuid not null,
  user_id      uuid not null,
  date         date not null,
  total_value  numeric(14,2) not null,
  cash         numeric(14,2) not null,
  return_pct   numeric(10,4) not null, -- rendement cumulé de la saison, en %
  rank_overall int,
  primary key (league_id, user_id, date),
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Données de marché (globales, alimentées par les tâches planifiées)
-- -----------------------------------------------------------------------------
create table public.price_cache (
  ticker      text primary key,
  name        text,
  price       numeric(14,4) not null,
  prev_close  numeric(14,4),
  change_pct  numeric(10,4),
  currency    text not null default 'USD',
  updated_at  timestamptz not null default now()
);

-- Liste par défaut des entreprises suivies pour les pronostics (~50).
create table public.watchlist_defaults (
  ticker text primary key,
  name   text not null
);

-- Liste propre à chaque ligue (copiée depuis la liste par défaut, modifiable par l'admin).
create table public.league_tickers (
  league_id uuid not null references public.leagues (id) on delete cascade,
  ticker    text not null,
  primary key (league_id, ticker)
);

create table public.earnings_events (
  id            bigint generated always as identity primary key,
  ticker        text not null,
  report_date   date not null,
  timing        public.earnings_timing not null default 'unknown',
  fiscal_year   int,
  fiscal_quarter int check (fiscal_quarter between 1 and 4),
  metric        text not null default 'eps' check (metric in ('eps', 'revenue')), -- futur : chiffre d'affaires
  eps_estimate  numeric(12,4),
  eps_actual    numeric(12,4),
  lock_at       timestamptz not null, -- heure de verrouillage des pronostics (calculée à l'import)
  status        public.event_status not null default 'scheduled',
  resolve_attempts int not null default 0,
  last_attempt_at timestamptz,
  resolved_at   timestamptz,
  updated_at    timestamptz not null default now(),
  unique (ticker, report_date, metric)
);
create index earnings_events_date_idx on public.earnings_events (report_date);
create index earnings_events_pending_idx on public.earnings_events (status, lock_at);

-- -----------------------------------------------------------------------------
-- Pronostics et points
-- -----------------------------------------------------------------------------
create table public.predictions (
  id                bigint generated always as identity primary key,
  league_id         uuid not null,
  user_id           uuid not null,
  earnings_event_id bigint not null references public.earnings_events (id) on delete cascade,
  choice            public.prediction_choice not null,
  confidence        public.prediction_confidence not null default 'normal',
  outcome           public.prediction_outcome not null default 'pending',
  points            int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  unique (league_id, user_id, earnings_event_id),
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);
create index predictions_event_idx on public.predictions (earnings_event_id);

-- Chaque point gagné ou perdu est tracé ici. Le score = somme des montants.
create table public.points_ledger (
  id         bigint generated always as identity primary key,
  league_id  uuid not null,
  user_id    uuid not null,
  source     public.points_source not null,
  amount     int not null,
  reason     text not null,
  ref_id     text, -- ex. id de prédiction, date du snapshot
  created_at timestamptz not null default now(),
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);
create index points_ledger_league_idx on public.points_ledger (league_id, user_id);

-- -----------------------------------------------------------------------------
-- Côté fun : fil d'activité, titres, badges
-- -----------------------------------------------------------------------------
create table public.activity_feed (
  id         bigint generated always as identity primary key,
  league_id  uuid not null references public.leagues (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  type       text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_feed_league_idx on public.activity_feed (league_id, created_at desc);

create table public.player_titles (
  league_id  uuid not null,
  user_id    uuid not null,
  title_key  text not null,
  awarded_on date not null default current_date,
  primary key (league_id, title_key),
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);

create table public.user_badges (
  league_id  uuid not null,
  user_id    uuid not null,
  badge_key  text not null,
  awarded_at timestamptz not null default now(),
  primary key (league_id, user_id, badge_key),
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);

-- =============================================================================
-- Fonctions utilitaires pour RLS
-- "security definer" + search_path figé : elles lisent league_members sans
-- déclencher récursivement les policies de cette même table.
-- =============================================================================
create or replace function public.is_league_member(p_league_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.league_members m
    where m.league_id = p_league_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_league_admin(p_league_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.league_members m
    where m.league_id = p_league_id and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create or replace function public.shares_league_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members a
    join public.league_members b on b.league_id = a.league_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user_id
  );
$$;

-- Code d'invitation lisible : 6 caractères sans 0/O/1/I pour éviter les confusions.
create or replace function public.generate_invite_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;
  return code;
end;
$$;

-- =============================================================================
-- Création automatique du profil à l'inscription
-- Pseudo par défaut : nom Google, sinon la partie avant @ de l'email.
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  base text;
begin
  base := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  base := left(regexp_replace(base, '\s+', ' ', 'g'), 24);
  if char_length(base) < 2 then
    base := 'Joueur ' || substr(new.id::text, 1, 4);
  end if;

  insert into public.profiles (id, pseudo, avatar_url)
  values (
    new.id,
    base,
    case when (new.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
         then new.raw_user_meta_data ->> 'avatar_url' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.leagues             enable row level security;
alter table public.league_members      enable row level security;
alter table public.holdings            enable row level security;
alter table public.transactions        enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.price_cache         enable row level security;
alter table public.watchlist_defaults  enable row level security;
alter table public.league_tickers      enable row level security;
alter table public.earnings_events     enable row level security;
alter table public.predictions         enable row level security;
alter table public.points_ledger       enable row level security;
alter table public.activity_feed       enable row level security;
alter table public.player_titles       enable row level security;
alter table public.user_badges         enable row level security;

-- Profils : je vois le mien et ceux des joueurs de mes ligues ; je ne modifie que le mien.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_league_with(id));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Seules ces colonnes sont modifiables (le reste est protégé au niveau des droits).
revoke update on public.profiles from authenticated, anon;
grant update (pseudo, avatar_url) on public.profiles to authenticated;

-- Ligues et données de jeu : lecture réservée aux membres. Écriture : via RPC uniquement.
create policy "leagues_select" on public.leagues for select to authenticated
  using (public.is_league_member(id));
create policy "members_select" on public.league_members for select to authenticated
  using (public.is_league_member(league_id));
create policy "holdings_select" on public.holdings for select to authenticated
  using (public.is_league_member(league_id));
create policy "transactions_select" on public.transactions for select to authenticated
  using (public.is_league_member(league_id));
create policy "snapshots_select" on public.portfolio_snapshots for select to authenticated
  using (public.is_league_member(league_id));
create policy "league_tickers_select" on public.league_tickers for select to authenticated
  using (public.is_league_member(league_id));
create policy "ledger_select" on public.points_ledger for select to authenticated
  using (public.is_league_member(league_id));
create policy "feed_select" on public.activity_feed for select to authenticated
  using (public.is_league_member(league_id));
create policy "titles_select" on public.player_titles for select to authenticated
  using (public.is_league_member(league_id));
create policy "badges_select" on public.user_badges for select to authenticated
  using (public.is_league_member(league_id));

-- Pronostics : je vois toujours les miens ; ceux des autres seulement après verrouillage.
create policy "predictions_select" on public.predictions for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.is_league_member(league_id)
      and exists (
        select 1 from public.earnings_events e
        where e.id = earnings_event_id and e.lock_at <= now()
      )
    )
  );

-- Données de marché : lecture pour tout utilisateur connecté (aucune donnée personnelle).
create policy "prices_select" on public.price_cache for select to authenticated using (true);
create policy "watchlist_select" on public.watchlist_defaults for select to authenticated using (true);
create policy "earnings_select" on public.earnings_events for select to authenticated using (true);

-- Par défaut, Supabase donne des droits larges à anon/authenticated sur le schéma
-- public : on retire toute écriture directe sur les tables de jeu (ceinture + bretelles,
-- en plus de l'absence de policy d'écriture).
revoke insert, update, delete on
  public.leagues, public.league_members, public.holdings, public.transactions,
  public.portfolio_snapshots, public.price_cache, public.watchlist_defaults,
  public.league_tickers, public.earnings_events, public.predictions,
  public.points_ledger, public.activity_feed, public.player_titles, public.user_badges
from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- Les fonctions utilitaires ne sont pas appelables par les visiteurs anonymes.
revoke execute on function public.is_league_member(uuid), public.is_league_admin(uuid),
  public.shares_league_with(uuid), public.generate_invite_code(), public.handle_new_user()
from public, anon;
grant execute on function public.is_league_member(uuid), public.is_league_admin(uuid),
  public.shares_league_with(uuid) to authenticated;
