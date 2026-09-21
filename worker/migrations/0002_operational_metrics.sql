CREATE TABLE IF NOT EXISTS analyst_activity_metrics (
  day TEXT NOT NULL,
  analyst_id TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  analysis_count INTEGER NOT NULL DEFAULT 0,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  conforme_count INTEGER NOT NULL DEFAULT 0,
  nao_conforme_count INTEGER NOT NULL DEFAULT 0,
  reprovado_count INTEGER NOT NULL DEFAULT 0,
  no_decision_count INTEGER NOT NULL DEFAULT 0,
  ai_response_count INTEGER NOT NULL DEFAULT 0,
  local_response_count INTEGER NOT NULL DEFAULT 0,
  duration_ms_total INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (day, analyst_id)
);

CREATE TABLE IF NOT EXISTS ai_attempt_metrics (
  day TEXT NOT NULL,
  analyst_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'workers-ai')),
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'api_error', 'rate_limited', 'invalid_response')),
  request_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms_total INTEGER NOT NULL DEFAULT 0,
  duration_ms_max INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (day, analyst_id, provider, model, status)
);

CREATE INDEX IF NOT EXISTS idx_activity_metrics_day
  ON analyst_activity_metrics(day DESC);

CREATE INDEX IF NOT EXISTS idx_ai_attempt_metrics_day
  ON ai_attempt_metrics(day DESC);
