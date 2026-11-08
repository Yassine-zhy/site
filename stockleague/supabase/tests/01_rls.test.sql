-- Tests de sécurité (RLS) du schéma initial.
-- Chaque bloc agit "en tant que" un joueur grâce à set role + request.jwt.claim.sub.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'yanis@example.com', '{"full_name":"Yanis B."}'),
  ('00000000-0000-0000-0000-00000000000b', 'lea@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'x@example.com', '{}');

select test.assert((select pseudo from profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Yanis B.',
  'le pseudo vient du nom Google');
select test.assert((select pseudo from profiles where id = '00000000-0000-0000-0000-00000000000b') = 'lea',
  'le pseudo vient de l''email');
select test.assert((select pseudo from profiles where id = '00000000-0000-0000-0000-00000000000c') like 'Joueur %',
  'pseudo de repli si trop court');

insert into leagues (id, name, invite_code, owner_id, start_date, end_date)
values ('10000000-0000-0000-0000-000000000001', 'Les Loups', public.generate_invite_code(),
        '00000000-0000-0000-0000-00000000000a', current_date, current_date + 30);
insert into league_members (league_id, user_id, role, cash) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin', 10000),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member', 10000);

insert into earnings_events (id, ticker, report_date, timing, lock_at, eps_estimate)
overriding system value values
  (1, 'AAPL', current_date + 1, 'amc', now() + interval '1 day', 1.5),
  (2, 'NKE', current_date - 1, 'amc', now() - interval '1 hour', 0.7);
insert into predictions (league_id, user_id, earnings_event_id, choice) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1, 'beat'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 2, 'miss');

-- ---------------------------------------------------------------- Joueur C (hors ligue)
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select test.assert((select count(*) from leagues) = 0, 'C ne voit aucune ligue');
select test.assert((select count(*) from league_members) = 0, 'C ne voit aucun membre');
select test.assert((select count(*) from profiles) = 1, 'C ne voit que son propre profil');
select test.assert((select count(*) from predictions) = 0, 'C ne voit aucun pronostic');
select test.assert((select count(*) from watchlist_defaults) >= 50, 'la liste par défaut est lisible');

-- ---------------------------------------------------------------- Joueur B (membre)
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select test.assert((select count(*) from leagues) = 1, 'B voit sa ligue');
select test.assert((select count(*) from profiles) = 2, 'B voit le profil de A (même ligue)');
select test.assert((select count(*) from predictions) = 1,
  'B ne voit que le pronostic verrouillé de A (pas celui encore ouvert)');

do $$ begin
  insert into leagues (name, invite_code, owner_id, start_date, end_date)
  values ('Triche', 'ABCDEF', auth.uid(), current_date, current_date + 1);
  raise exception 'ÉCHEC : B a pu créer une ligue directement';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  update league_members set cash = 1000000 where user_id = auth.uid();
  raise exception 'ÉCHEC : B a pu modifier son cash';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- Joueur A : profil
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update profiles set pseudo = 'Yan' where id = auth.uid();
select test.assert((select pseudo from profiles where id = auth.uid()) = 'Yan', 'A modifie son pseudo');
update profiles set pseudo = 'Piraté' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
select test.assert((select pseudo from profiles where id = '00000000-0000-0000-0000-00000000000b') = 'lea',
  'A ne peut pas modifier le profil de B');
set local role authenticated;
do $$ begin
  update profiles set created_at = now() - interval '10 years' where id = auth.uid();
  raise exception 'ÉCHEC : A a pu modifier created_at';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- Anonyme
set local role anon;
set local request.jwt.claim.sub = '';
select test.assert((select count(*) from leagues) = 0, 'un visiteur anonyme ne voit aucune ligue');

rollback;
