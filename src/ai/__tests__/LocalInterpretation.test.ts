import { describe, expect, it } from 'vitest';
import { createLocalInterpretation } from '../LocalInterpretation';
import { ruleEngine } from '../../services/RuleEngine';
import { splitTextClauses } from '../../services/TextNormalizer';
import { AebotAnalysisService } from '../../services/AnalysisService';
import type { StructuredModelClient } from '../StructuredModelClient';

const service = ruleEngine.getServices()[0];
const rules = ruleEngine.getRulesForService(service.id);
const during = rules.find((rule) => rule.conditionKeywords.includes('sem foto durante'))!;
const query = 'Tem foto antes e depois, mas não mostrou o reparo sendo executado.';
const local = createLocalInterpretation(query, service, rules);
const response = (sourceId: unknown, overrides: Record<string, unknown> = {}) => JSON.stringify({
  mappings: [{ sourceId, ruleId: during.id, stance: 'asserted', ...overrides }],
  conversation: { answer: 'Falta a evidência da execução.', question: '' },
});

describe('interpretação local por trechos', () => {
  it('conecta o contrato local ao motor compartilhado sem liberar decisão do modelo', async () => {
    const client: StructuredModelClient = {
      provider: 'local', providerChain: ['local'], cacheKey: 'test-local-sources',
      async request(_contents, _instruction, _limit, options) {
        const text = response(1);
        expect(options?.validateText?.(text)).toBe(true);
        return { provider: 'local', status: 'ok', text };
      },
    };
    const analysis = new AebotAnalysisService({ modelClient: client, humanizeDeterministicResponses: false });
    const result = await analysis.analyze({ serviceId: service.id, prompt: query, history: [] });
    expect(result.decision).toBe('Não Conforme');
    expect(result.evaluation.semanticMappings?.[0].sourceQuote).toBe('não mostrou o reparo sendo executado.');
    expect(result.evaluation.matchedRules.map((rule) => rule.id)).toContain(during.id);
  });
  it('separa contraste sem alterar o texto citado nem remover interrogação', () => {
    expect(splitTextClauses('Tem foto antes, faltou depois. Como fica?')).toEqual([
      'Tem foto antes', 'faltou depois.', 'Como fica?',
    ]);
  });
  it('reconstrói a evidência com o trecho real escolhido pelo modelo', () => {
    const result = local.parse(response(1));
    expect(result?.canonicalPrompt).toBe('sem foto durante');
    expect(result?.mappings[0].sourceQuote).toBe('não mostrou o reparo sendo executado.');
  });
  it.each([-1, 2, 1.5, '1', null])('recusa sourceId inexistente ou inválido: %s', (sourceId) => {
    expect(local.parse(response(sourceId))).toBeNull();
  });
  it('não deixa uma citação inventada substituir a origem validada', () => {
    const result = local.parse(response(0, { sourceQuote: 'Não tem foto durante' }));
    expect(result?.canonicalPrompt).toBeNull();
    expect(result?.mappings[0].stance).toBe('negated_or_present');
  });
  it('recusa regra inexistente e preserva conversa quando não houver regra', () => {
    expect(local.parse(response(1, { ruleId: 'regra-inventada' }))).toBeNull();
    expect(local.parse(JSON.stringify({ mappings: [], conversation: {
      answer: 'Preciso de mais uma informação.', question: 'Qual evidência faltou?',
    } }))?.conversation?.question).toBe('Qual evidência faltou?');
  });
  it('preserva pergunta pendente e uma resposta curta do caso', () => {
    const request = createLocalInterpretation('interna', service, rules, ['Qual tipo de equipe?'],
      { allowSingleTokenQuote: true });
    expect(request.prompt).toContain('Qual tipo de equipe?');
    expect(request.prompt).toContain('"sourceId":0,"text":"interna"');
  });
});
