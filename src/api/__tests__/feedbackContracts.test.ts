import { describe, expect, it } from 'vitest';
import { parseFeedbackSubmission } from '../feedbackContracts';

describe('contrato de feedback', () => {
  it('normaliza uma submissão válida', () => {
    expect(parseFeedbackSubmission({
      serviceId: ' servico-a ',
      category: 'sugestao',
      message: '  Seria útil explicar melhor esta regra.  ',
      appVersion: '2.5.0',
    })).toEqual({
      serviceId: 'servico-a',
      category: 'sugestao',
      message: 'Seria útil explicar melhor esta regra.',
      appVersion: '2.5.0',
    });
  });

  it('recusa categoria, versão e mensagem inválidas', () => {
    expect(() => parseFeedbackSubmission({
      serviceId: 'servico-a',
      category: 'decisao_secreta',
      message: 'curto',
      appVersion: 'latest',
    })).toThrow('categoria de feedback inválida');
  });
});
