CREATE TABLE IF NOT EXISTS analyst_feedback (
  id TEXT PRIMARY KEY NOT NULL,
  analyst_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'resposta_incorreta',
      'regra_ausente',
      'dificuldade_entendimento',
      'interface',
      'sugestao',
      'outro'
    )
  ),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 2000),
  app_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status = 'new')
);

CREATE INDEX IF NOT EXISTS idx_analyst_feedback_created_at
  ON analyst_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyst_feedback_category_created_at
  ON analyst_feedback(category, created_at DESC);
