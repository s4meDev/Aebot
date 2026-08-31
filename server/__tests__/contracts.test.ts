import { describe, expect, it } from 'vitest';
import { parseAnalyzeRequest, RequestValidationError } from '../contracts';

describe('contrato POST /v1/analyze', () => {
  it('normaliza uma requisição válida', () => {
    expect(parseAnalyzeRequest({
      serviceId: 'reparo-cavalete',
      prompt: '  sem foto durante  ',
      history: [{ id: '1', role: 'user', content: 'caso anterior', timestamp: '10:00' }],
    })).toMatchObject({
      serviceId: 'reparo-cavalete',
      prompt: 'sem foto durante',
      history: [{ role: 'user', content: 'caso anterior' }],
    });
  });

  it('preserva a informação pendente sem confiar no texto da resposta', () => {
    const parsed = parseAnalyzeRequest({
      serviceId: 'repavimentacao-calcada',
      prompt: 'interna',
      history: [{
        id: 'assistant-1',
        role: 'assistant',
        content: 'Preciso de uma informação.',
        pendingInformation: ['A equipe é interna ou terceirizada?'],
        timestamp: '10:01',
      }],
    });

    expect(parsed.history[0].pendingInformation).toEqual([
      'A equipe é interna ou terceirizada?',
    ]);
  });

  it.each([
    [{ prompt: 'teste' }],
    [{ serviceId: '../outro', prompt: 'teste' }],
    [{ serviceId: 'servico', prompt: '' }],
    [{ serviceId: 'servico', prompt: 'teste', history: Array.from({ length: 13 }, () => ({})) }],
  ])('recusa payload inválido %#', (payload) => {
    expect(() => parseAnalyzeRequest(payload)).toThrow(RequestValidationError);
  });
});
