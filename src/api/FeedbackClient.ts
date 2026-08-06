import manifest from '../../manifest.json';
import { resolveBackendUrl } from '../ai/BackendClient';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { storageAdapter } from '../storage/StorageAdapter';
import type { FeedbackCategory } from './feedbackContracts';

const FEEDBACK_TIMEOUT_MS = 10_000;

export type FeedbackSubmitResult =
  | { state: 'saved'; feedbackId: string }
  | { state: 'not_configured'; message: string }
  | { state: 'unauthorized'; message: string }
  | { state: 'unavailable'; message: string }
  | { state: 'invalid'; message: string }
  | { state: 'error'; message: string };

function appVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version ?? manifest.version;
  }
  return manifest.version;
}

export async function submitFeedback(input: {
  serviceId: string;
  category: FeedbackCategory;
  message: string;
}): Promise<FeedbackSubmitResult> {
  const backendUrl = resolveBackendUrl(
    storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '')
  );
  if (!backendUrl) {
    return {
      state: 'not_configured',
      message: 'O envio fica disponível quando a API online do AEBOT estiver configurada.',
    };
  }
  const token = storageAdapter.get<string>(STORAGE_KEYS.BACKEND_TOKEN, '').trim();
  if (!token) {
    return {
      state: 'unauthorized',
      message: 'Informe seu token do AEBOT nas configurações antes de enviar.',
    };
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FEEDBACK_TIMEOUT_MS);
  try {
    const response = await fetch(`${backendUrl}/v1/feedback`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...input, appVersion: appVersion() }),
    });
    if (response.status === 401) {
      return { state: 'unauthorized', message: 'Seu token não autorizou o envio do feedback.' };
    }
    if (response.status === 400) {
      return { state: 'invalid', message: 'Revise a categoria e escreva ao menos 10 caracteres.' };
    }
    if (response.status === 404 || response.status === 503) {
      return {
        state: 'unavailable',
        message: 'O armazenamento de feedback ainda não está habilitado nesta API.',
      };
    }
    if (!response.ok) {
      return { state: 'error', message: 'Não foi possível salvar o feedback agora.' };
    }
    const body = await response.json() as Record<string, unknown>;
    return typeof body.feedbackId === 'string' && body.feedbackId
      ? { state: 'saved', feedbackId: body.feedbackId }
      : { state: 'error', message: 'A API respondeu em um formato incompatível.' };
  } catch {
    return { state: 'error', message: 'Não foi possível conectar à API de feedback.' };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
