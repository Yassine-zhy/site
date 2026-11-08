/**
 * Types TypeScript du schéma Postgres.
 * Écrits à la main pour l'instant ; une fois le projet Supabase créé, on pourra
 * les régénérer avec : npx supabase gen types typescript --project-id <id>
 */
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type LeagueStatus = "draft" | "active" | "finished";
export type MemberRole = "admin" | "member";
export type TradeSide = "buy" | "sell";
export type EarningsTiming = "bmo" | "amc" | "unknown";
export type EventStatus = "scheduled" | "resolved" | "void";
export type PredictionChoice = "beat" | "miss";
export type PredictionConfidence = "normal" | "sure";
export type PredictionOutcome = "pending" | "correct" | "wrong" | "void";
export type PointsSource = "portfolio" | "prediction" | "streak" | "adjustment";

/** Les montants numeric arrivent en string ou number selon le client : on normalise côté app. */
type Numeric = number | string;

export type ProfileRow = { id: string; pseudo: string; avatar_url: string | null; created_at: string };
export type LeagueRow = {
  id: string; name: string; invite_code: string; invite_token: string; owner_id: string;
  starting_cash: Numeric; start_date: string; end_date: string; markets: string[]; fee: Numeric;
  max_players: number; allow_late_join: boolean; status: LeagueStatus; season: number;
  previous_league_id: string | null; visibility: "private" | "public"; is_demo: boolean;
  created_at: string; finished_at: string | null;
};
export type LeagueMemberRow = { league_id: string; user_id: string; role: MemberRole; cash: Numeric; joined_at: string };
export type HoldingRow = { league_id: string; user_id: string; ticker: string; quantity: Numeric; avg_cost: Numeric; updated_at: string };
export type TransactionRow = {
  id: number; league_id: string; user_id: string; ticker: string; side: TradeSide; order_type: "market" | "limit";
  quantity: Numeric; price: Numeric; fee: Numeric; cash_after: Numeric; market_open: boolean; executed_at: string;
};
export type PortfolioSnapshotRow = {
  league_id: string; user_id: string; date: string; total_value: Numeric; cash: Numeric; return_pct: Numeric; rank_overall: number | null;
};
export type PriceCacheRow = {
  ticker: string; name: string | null; price: Numeric; prev_close: Numeric | null; change_pct: Numeric | null; currency: string; updated_at: string;
};
export type EarningsEventRow = {
  id: number; ticker: string; report_date: string; timing: EarningsTiming; fiscal_year: number | null; fiscal_quarter: number | null;
  metric: "eps" | "revenue"; eps_estimate: Numeric | null; eps_actual: Numeric | null; lock_at: string; status: EventStatus;
  resolve_attempts: number; last_attempt_at: string | null; resolved_at: string | null; updated_at: string;
};
export type PredictionRow = {
  id: number; league_id: string; user_id: string; earnings_event_id: number; choice: PredictionChoice;
  confidence: PredictionConfidence; outcome: PredictionOutcome; points: number; created_at: string; updated_at: string; resolved_at: string | null;
};
export type PointsLedgerRow = {
  id: number; league_id: string; user_id: string; source: PointsSource; amount: number; reason: string; ref_id: string | null; created_at: string;
};
export type ActivityFeedRow = { id: number; league_id: string; actor_id: string | null; type: string; payload: Record<string, unknown>; created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id" | "pseudo">;
      leagues: Table<LeagueRow, "name" | "invite_code" | "owner_id" | "start_date" | "end_date">;
      league_members: Table<LeagueMemberRow, "league_id" | "user_id" | "cash">;
      holdings: Table<HoldingRow, "league_id" | "user_id" | "ticker" | "quantity" | "avg_cost">;
      transactions: Table<TransactionRow>;
      portfolio_snapshots: Table<PortfolioSnapshotRow>;
      price_cache: Table<PriceCacheRow, "ticker" | "price">;
      watchlist_defaults: Table<{ ticker: string; name: string }, "ticker" | "name">;
      league_tickers: Table<{ league_id: string; ticker: string }, "league_id" | "ticker">;
      earnings_events: Table<EarningsEventRow>;
      predictions: Table<PredictionRow>;
      points_ledger: Table<PointsLedgerRow>;
      activity_feed: Table<ActivityFeedRow>;
      player_titles: Table<{ league_id: string; user_id: string; title_key: string; awarded_on: string }>;
      user_badges: Table<{ league_id: string; user_id: string; badge_key: string; awarded_at: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
