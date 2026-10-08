/** Contrato do verificador Node; nenhuma credencial é devolvida ao chamador. */
export interface SigningConfiguration {
  forceCodeSigning?: boolean;
  win?: {
    signAndEditExecutable?: boolean;
    signtoolOptions?: {
      certificateSha1?: string;
      certificateSubjectName?: string;
      certificateFile?: string;
      sign?: string;
    };
    azureSignOptions?: Record<string, unknown>;
  };
}

export function signingConfigurationSource(
  config: SigningConfiguration,
  environment?: Record<string, string | undefined>,
): string;
