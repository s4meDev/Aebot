/**
 * Chaves de persistência local usadas pela extensão.
 * Mantidas em um único lugar para evitar strings mágicas duplicadas
 * entre componentes, providers e hooks.
 */
export const STORAGE_KEYS = {
  GEMINI_API_KEY: 'aegea_gemini_api_key',
  GEMINI_MODEL: 'aegea_gemini_model',
  BACKEND_URL: 'aebot_backend_url',
  BACKEND_TOKEN: 'aebot_backend_token',
  BACKEND_RULE_STORE_VERSION: 'aebot_backend_rule_store_version',
  SELECTED_SERVICE_ID: 'selectedServiceId',
} as const;
