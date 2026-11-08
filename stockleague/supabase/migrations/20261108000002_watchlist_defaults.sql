-- Liste par défaut des ~50 grandes capitalisations suivies pour les pronostics.
-- Chaque ligue en reçoit une copie à sa création ; l'admin peut ensuite la modifier.
insert into public.watchlist_defaults (ticker, name) values
  ('AAPL', 'Apple'), ('MSFT', 'Microsoft'), ('NVDA', 'Nvidia'), ('AMZN', 'Amazon'),
  ('GOOGL', 'Alphabet'), ('META', 'Meta Platforms'), ('TSLA', 'Tesla'), ('AVGO', 'Broadcom'),
  ('NFLX', 'Netflix'), ('AMD', 'AMD'), ('ORCL', 'Oracle'), ('CRM', 'Salesforce'),
  ('ADBE', 'Adobe'), ('INTC', 'Intel'), ('QCOM', 'Qualcomm'), ('IBM', 'IBM'),
  ('UBER', 'Uber'), ('ABNB', 'Airbnb'), ('SHOP', 'Shopify'), ('PYPL', 'PayPal'),
  ('JPM', 'JPMorgan Chase'), ('BAC', 'Bank of America'), ('GS', 'Goldman Sachs'), ('MS', 'Morgan Stanley'),
  ('V', 'Visa'), ('MA', 'Mastercard'), ('AXP', 'American Express'), ('BRK.B', 'Berkshire Hathaway'),
  ('WMT', 'Walmart'), ('COST', 'Costco'), ('TGT', 'Target'), ('HD', 'Home Depot'),
  ('NKE', 'Nike'), ('SBUX', 'Starbucks'), ('MCD', 'McDonald''s'), ('KO', 'Coca-Cola'),
  ('PEP', 'PepsiCo'), ('PG', 'Procter & Gamble'), ('DIS', 'Disney'), ('LULU', 'Lululemon'),
  ('JNJ', 'Johnson & Johnson'), ('PFE', 'Pfizer'), ('LLY', 'Eli Lilly'), ('UNH', 'UnitedHealth'),
  ('XOM', 'ExxonMobil'), ('CVX', 'Chevron'), ('BA', 'Boeing'), ('CAT', 'Caterpillar'),
  ('GM', 'General Motors'), ('F', 'Ford')
on conflict (ticker) do nothing;
