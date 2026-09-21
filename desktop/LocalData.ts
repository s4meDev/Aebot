import { readFile, writeFile, rename, mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AiProviderResponse } from '../src/types';
import { parseFeedbackSubmission, type FeedbackSubmission } from '../src/api/feedbackContracts';

export async function readJsonFile(file: string, limit = 4_000_000): Promise<unknown> {
  if ((await stat(file)).size > limit) throw new Error('Arquivo excede o tamanho permitido.');
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

export async function atomicJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, file);
}

interface Summary { analyses: number; modelCalls: number; modelErrors: number; durationMs: number }
interface LocalFeedback extends FeedbackSubmission { id: string; createdAt: string }

/** Guarda contagens e feedback voluntário. O histórico de chat existe só na tela. */
export class LocalData {
  summary: Summary = { analyses: 0, modelCalls: 0, modelErrors: 0, durationMs: 0 };
  private feedback: LocalFeedback[] = [];
  private feedbackQueue: Promise<unknown> = Promise.resolve();
  private feedbackReadError = false;
  constructor(private readonly directory: string) {}
  async load(): Promise<void> {
    try {
      const data = await readJsonFile(path.join(this.directory, 'metrics.json')) as Summary;
      if (['analyses', 'modelCalls', 'modelErrors', 'durationMs'].every((key) =>
        Number.isSafeInteger(data[key as keyof Summary]) && data[key as keyof Summary] >= 0)) {
        this.summary = { analyses: data.analyses, modelCalls: data.modelCalls,
          modelErrors: data.modelErrors, durationMs: data.durationMs };
      }
    } catch { /* A primeira execução começa com contadores vazios. */ }
    try {
      const data = await readJsonFile(path.join(this.directory, 'feedback.json'), 12_000_000);
      if (!Array.isArray(data) || data.length > 1000) throw new Error('Feedback local inválido.');
      this.feedback = data.map((value: unknown) => {
        if (!value || typeof value !== 'object') throw new Error('Registro inválido.');
        const item = value as Record<string, unknown>;
        if (typeof item.id !== 'string' || item.id.length > 100 || typeof item.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(item.createdAt))) throw new Error('Registro inválido.');
        return { ...parseFeedbackSubmission(item), id: item.id, createdAt: item.createdAt };
      });
      this.feedbackReadError = false;
    } catch (error) {
      // Um arquivo danificado precisa de recuperação, não de sobrescrita silenciosa.
      this.feedbackReadError = (error as NodeJS.ErrnoException).code !== 'ENOENT';
    }
  }
  async record(result: AiProviderResponse, durationMs: number): Promise<void> {
    this.summary.analyses += 1;
    this.summary.durationMs += Math.max(0, Math.round(durationMs));
    this.summary.modelCalls += result.modelAttempts?.length ?? 0;
    this.summary.modelErrors += result.modelAttempts?.filter((item) => item.status !== 'ok').length ?? 0;
    await atomicJson(path.join(this.directory, 'metrics.json'), this.summary);
  }
  async saveFeedback(input: FeedbackSubmission): Promise<string> {
    // Dois cliques/requisições simultâneos não podem sobrescrever um ao outro.
    const operation = this.feedbackQueue.then(() => this.appendFeedback(input));
    this.feedbackQueue = operation.catch(() => undefined);
    return operation;
  }
  private async appendFeedback(input: FeedbackSubmission): Promise<string> {
    if (this.feedbackReadError) throw new Error('Não foi possível ler os feedbacks salvos. Solicite à TI a recuperação do arquivo antes de enviar outro.');
    if (this.feedback.length >= 1000) throw new Error('Limite local de feedback atingido. Exporte o relatório e contate o responsável.');
    const id = randomUUID();
    const updated = [...this.feedback, { ...input, id, createdAt: new Date().toISOString() }];
    await atomicJson(path.join(this.directory, 'feedback.json'), updated);
    this.feedback = updated;
    return id;
  }
  report() { return { format: 'aebot-pilot-report-v1', generatedAt: new Date().toISOString(),
    metrics: { ...this.summary }, feedback: [...this.feedback],
    feedbackWarning: this.feedbackReadError ? 'Arquivo local de feedback ilegível; relatório incompleto. Solicite recuperação à TI.' : undefined }; }
}

export async function preservePreviousRules(file: string): Promise<void> {
  try { await copyFile(file, `${file}.previous`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
