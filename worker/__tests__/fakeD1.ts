import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from '../feedbackRepository';

export interface FakeFeedbackRow {
  id: string;
  analyst_id: string;
  service_id: string;
  category: string;
  message: string;
  app_version: string;
  created_at: string;
  status: 'new';
}

class FakeStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly rows: FakeFeedbackRow[]
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    if (/INSERT INTO analyst_feedback/i.test(this.query)) {
      const [id, analystId, serviceId, category, message, appVersion, createdAt] = this.values;
      this.rows.push({
        id: String(id),
        analyst_id: String(analystId),
        service_id: String(serviceId),
        category: String(category),
        message: String(message),
        app_version: String(appVersion),
        created_at: String(createdAt),
        status: 'new',
      });
    }
    return { success: true, results: [] };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const hasCategory = /WHERE category = \?/i.test(this.query);
    const category = hasCategory ? String(this.values[0]) : undefined;
    const limit = Number(this.values[hasCategory ? 1 : 0]);
    const offset = Number(this.values[hasCategory ? 2 : 1]);
    const results = this.rows
      .filter((row) => !category || row.category === category)
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(offset, offset + limit) as unknown as T[];
    return { success: true, results };
  }
}

export function createFakeD1(initialRows: FakeFeedbackRow[] = []) {
  const rows = [...initialRows];
  const database: D1Database = {
    prepare(query: string) {
      return new FakeStatement(query, rows);
    },
  };
  return { database, rows };
}
