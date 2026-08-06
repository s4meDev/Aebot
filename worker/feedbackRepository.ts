import type {
  FeedbackCategory,
  FeedbackSubmission,
  StoredFeedback,
} from '../src/api/feedbackContracts';

export interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results: T[];
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface FeedbackRow {
  id: string;
  analyst_id: string;
  service_id: string;
  category: FeedbackCategory;
  message: string;
  app_version: string;
  created_at: string;
  status: 'new';
}

export interface SaveFeedbackInput extends FeedbackSubmission {
  id: string;
  analystId: string;
  createdAt: string;
}

function storedFeedback(row: FeedbackRow): StoredFeedback {
  return {
    id: row.id,
    analystId: row.analyst_id,
    serviceId: row.service_id,
    category: row.category,
    message: row.message,
    appVersion: row.app_version,
    createdAt: row.created_at,
    status: row.status,
  };
}

export async function saveFeedback(
  database: D1Database,
  input: SaveFeedbackInput
): Promise<void> {
  // Todos os valores entram por bind; nenhum texto do analista vira parte do SQL.
  const result = await database.prepare(`
    INSERT INTO analyst_feedback (
      id, analyst_id, service_id, category, message, app_version, created_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
  `).bind(
    input.id,
    input.analystId,
    input.serviceId,
    input.category,
    input.message,
    input.appVersion,
    input.createdAt
  ).run();
  if (!result.success) throw new Error('feedback_write_failed');
}

export async function listFeedback(
  database: D1Database,
  options: { category?: FeedbackCategory; limit: number; offset?: number }
): Promise<StoredFeedback[]> {
  // A consulta muda somente para acrescentar o filtro conhecido de categoria.
  const columns = `
    id, analyst_id, service_id, category, message, app_version, created_at, status
  `;
  const statement = options.category
    ? database.prepare(`
        SELECT ${columns}
        FROM analyst_feedback
        WHERE category = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
      `).bind(options.category, options.limit, options.offset ?? 0)
    : database.prepare(`
        SELECT ${columns}
        FROM analyst_feedback
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
      `).bind(options.limit, options.offset ?? 0);
  const result = await statement.all<FeedbackRow>();
  if (!result.success) throw new Error('feedback_read_failed');
  return result.results.map(storedFeedback);
}
