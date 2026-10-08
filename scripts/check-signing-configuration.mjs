import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Confere só a configuração. A validade criptográfica continua sendo conferida após assinar. */
export function signingConfigurationSource(config, environment = process.env) {
  if (config?.forceCodeSigning !== true || config?.win?.signAndEditExecutable === false) {
    throw new Error('O pacote empresarial deve manter a assinatura obrigatória.');
  }
  const configured = (value) => typeof value === 'string' && Boolean(value.trim());
  const signing = config.win?.signtoolOptions;
  if (configured(environment.WIN_CSC_LINK) || configured(environment.CSC_LINK)) return 'ambiente seguro';
  if (configured(signing?.certificateSha1) || configured(signing?.certificateSubjectName)) return 'repositório de certificados';
  if (configured(signing?.certificateFile)) return 'arquivo configurado pela TI';
  if (configured(signing?.sign)) return 'integração de assinatura';
  if (config.win?.azureSignOptions && typeof config.win.azureSignOptions === 'object') return 'serviço de assinatura';
  throw new Error('Falta configurar o certificado ou serviço de assinatura do AEBOT. Autorização não substitui a credencial. Veja docs/ASSINATURA-E-LIBERACAO-WINDOWS.md.');
}

// Não imprime caminho, senha, certificado em base64 ou qualquer valor de variável.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = JSON.parse(await readFile(new URL('../electron-builder.json', import.meta.url), 'utf8'));
    console.log(`Configuração de assinatura encontrada: ${signingConfigurationSource(config)}. A validade ainda será verificada no empacotamento.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Não foi possível conferir a configuração de assinatura.');
    process.exitCode = 1;
  }
}
