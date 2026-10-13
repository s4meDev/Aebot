import { describe, expect, it, vi } from 'vitest';
import { inspectAnalysisCoverage } from '../AnalysisCoverage';
import { ruleEngine } from '../RuleEngine';
import { AebotAnalysisService } from '../AnalysisService';
import type { StructuredModelClient } from '../../ai/StructuredModelClient';

const serviceId = 'repavimentacao-asfalto-ate-1m2';
const rules = ruleEngine.getRulesForService(serviceId);
const before = rules.find(rule => rule.conditionKeywords.includes('sem foto antes'))!;
const during = rules.find(rule => rule.conditionKeywords.includes('sem foto durante'))!;
const identity = { serviceId, history: [] };
const client = (request: StructuredModelClient['request']): StructuredModelClient => ({
  provider: 'local', providerChain: ['local'], cacheKey: 'coverage-test', localInterpretationProtocol: 'indexed', request });

describe('análise completa antes de fechar a OS', () => {
  it('libera relato simples totalmente coberto pelas regras, sem pedir IA', async () => {
    const request = vi.fn();
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ ...identity, prompt: 'Sem foto antes.' });
    expect(response.decision).toBe('Não Conforme');
    expect(request).not.toHaveBeenCalled();
  });
  it('preserva a combinação de dois fatos conhecidos sem inferência', async () => {
    const request = vi.fn();
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ ...identity, prompt: 'Sem foto antes. Sem foto durante.' });
    expect(response.decision).toBe('Reprovado');
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['As fotos estão tremidas.', 'MEDIÇÃO INCOERENTE!!!'])(
    'um cenário direto totalmente reconhecido não precisa de IA só pela gramática curta: %s', async prompt => {
      const request = vi.fn();
      const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
        .analyze({ ...identity, prompt });
      expect(response.decision).toBe('Não Conforme');
      expect(request).not.toHaveBeenCalled();
    });
  it.each(['Equipe interna sem aferição da vala.', 'Equipe terceirizada sem aferição da vala.'])(
    'contexto obrigatório já confirmado não pede outra inferência: %s', async prompt => {
      const request = vi.fn();
      const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
        .analyze({ ...identity, prompt });
      expect(response.decision).toBe(prompt.includes('terceirizada') ? 'Reprovado' : 'Não Conforme');
      expect(request).not.toHaveBeenCalled();
    });
  it.each([
    'Sem foto antes. Não registraram nada enquanto espalhavam o material na vala.',
    'Sem foto antes e não registraram nada enquanto espalhavam o material na vala.',
  ])('não ignora a parte em linguagem livre quando a primeira parte já casou: %s', async prompt => {
    const request = vi.fn().mockResolvedValueOnce({ provider: 'local', status: 'ok',
      text: JSON.stringify({ m: [{ s: 1, r: during.id, t: 0 }] }) })
      .mockResolvedValueOnce({ provider: 'local', status: 'ok', text: '{"0":true,"1":true}' });
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ ...identity, prompt });
    expect(request).toHaveBeenCalledTimes(2);
    expect(response.decision).toBe('Reprovado');
    expect(response.evaluation.matchedRules.map(rule => rule.id)).toEqual(expect.arrayContaining([before.id, during.id]));
    // Interpretação e conferência usam o MESMO prefixo; nenhuma regra é retirada.
    expect(request.mock.calls[0][1]).toBe(request.mock.calls[1][1]);
    expect(request.mock.calls[1][0][0].parts[0].text).toContain('CONFERIR_ASSOCIACOES');
  });
  it.each(['api_error', 'empty'])('sem interpretação completa não fecha com a primeira irregularidade: %s', async failure => {
    const request = vi.fn().mockResolvedValue(failure === 'api_error' ? { provider: 'local', status: 'api_error' }
      : { provider: 'local', status: 'ok', text: '{"m":[]}' });
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ ...identity, prompt: 'Sem foto antes. Não registraram a equipe aplicando o material.' });
    expect(response.decision).toBeNull();
    expect(response.evaluation.outcome).toBe('advisory');
    expect(response.evaluation.matchedRules.map(rule => rule.id)).toContain(before.id);
    expect(response.content).toContain('outro ponto');
  });
  it('a conferência do modelo não apaga um fato lexical já comprovado no relato completo', async () => {
    const request = vi.fn().mockResolvedValueOnce({ provider: 'local', status: 'ok',
      text: JSON.stringify({ m: [{ s: 1, r: during.id, t: 0 }] }) })
      .mockResolvedValueOnce({ provider: 'local', status: 'ok', text: '{"0":false,"1":true}' });
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ ...identity, prompt: 'Sem foto antes. Não registraram nada enquanto espalhavam o material na vala.' });
    expect(response.decision).toBe('Reprovado');
    expect(response.evaluation.matchedRules.map(rule => rule.id)).toEqual(expect.arrayContaining([before.id, during.id]));
  });
  it('não considera uma palavra conhecida suficiente para cobrir o restante da oração', () => {
    const coverage = inspectAnalysisCoverage('Sem foto antes e ninguém consegue identificar a execução.', rules, 'relato_afirmativo');
    expect(coverage.unresolvedSources.length).toBeGreaterThan(0);
    expect(coverage.confirmedMappings.map(mapping => mapping.ruleId)).toContain(before.id);
  });
  it('uma resposta curta com outro fato não usa o atalho de contexto puro', async () => {
    const request = vi.fn().mockResolvedValue({ provider: 'local', status: 'api_error' });
    const previous = 'Sem aferição da vala.';
    const pendingInformation = ruleEngine.evaluatePrompt(previous, serviceId).advisory!.missingInformation;
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ serviceId, prompt: 'Interna, acabamento ruim.', history: [
        { id: 'user', role: 'user', content: previous, timestamp: '09:00' },
        { id: 'assistant', role: 'assistant', content: 'Qual o tipo de equipe?', pendingInformation, timestamp: '09:01' },
      ] });
    expect(request).toHaveBeenCalled();
    expect(response.decision).toBeNull();
    expect(response.evaluation.outcome).toBe('advisory');
  });
  it('não ignora outra ocorrência desconhecida só porque ela não tem uma palavra de ausência', async () => {
    const request = vi.fn().mockResolvedValue({ provider: 'local', status: 'ok', text: '{"m":[]}' });
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ ...identity, prompt: 'Sem foto antes. Eles fizeram em um ponto totalmente diferente.' });
    expect(response.decision).toBeNull();
    expect(response.evaluation.outcome).toBe('advisory');
    expect(response.evaluation.matchedRules.map(rule => rule.id)).toContain(before.id);
  });
  it('a cobertura não muda a avaliação de serviço desconhecido', async () => {
    const request = vi.fn();
    const response = await new AebotAnalysisService({ modelClient: client(request) })
      .analyze({ serviceId: 'inexistente', prompt: 'Sem foto antes.', history: [] });
    expect(response.decision).toBeNull();
    expect(response.evaluation.errorCode).toBe('SERVICE_NOT_FOUND');
    expect(request).not.toHaveBeenCalled();
  });
  it('não exige inferência para uma lista lexical com substantivo compartilhado', async () => {
    const request = vi.fn();
    const response = await new AebotAnalysisService({ modelClient: client(request), humanizeDeterministicResponses: false })
      .analyze({ ...identity, prompt: 'Sem foto antes nem durante.' });
    expect(response.decision).toBe('Reprovado');
    expect(request).not.toHaveBeenCalled();
  });
});
