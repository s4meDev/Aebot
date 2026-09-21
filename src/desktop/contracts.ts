import type { AnalysisRequest, AiProviderResponse, ServiceCatalogResult } from '../types';
import type { FeedbackSubmission } from '../api/feedbackContracts';

export interface DesktopStatus {
  state: 'starting' | 'ready' | 'unavailable';
  message: string;
  model: string;
  ruleVersion: string;
  rulesWarning?: string;
  analyses: number;
  modelCalls: number;
  modelErrors: number;
  averageDurationMs: number | null;
}

/** Uma função por operação. A interface nunca recebe acesso a arquivos ou processos. */
export interface DesktopBridge {
  analyze(input: AnalysisRequest): Promise<AiProviderResponse>;
  catalog(): Promise<ServiceCatalogResult>;
  status(): Promise<DesktopStatus>;
  restartModel(): Promise<DesktopStatus>;
  importRules(): Promise<{ changed: boolean; message: string }>;
  saveFeedback(input: FeedbackSubmission): Promise<{ feedbackId: string }>;
  exportReport(): Promise<{ saved: boolean }>;
}

declare global {
  interface Window { aebotDesktop?: DesktopBridge }
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.aebotDesktop;
}
