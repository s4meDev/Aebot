import { describe, expect, it, vi } from 'vitest';
import { createLocalInterpretation } from '../LocalInterpretation';
import { evidenceCatalog } from '../EvidenceInterpretation';
import { ruleEngine } from '../../services/RuleEngine';
import { splitTextClauses } from '../../services/TextNormalizer';
import { AebotAnalysisService } from '../../services/AnalysisService';
import type { StructuredModelClient, StructuredModelRequestOptions } from '../StructuredModelClient';

const service = ruleEngine.getServices()[0];
const rules = ruleEngine.getRulesForService(service.id);
const during = rules.find((rule) => rule.conditionKeywords.includes('sem foto durante'))!;
const before = rules.find((rule) => rule.conditionKeywords.includes('sem foto antes'))!;
const query = 'Tem foto antes e depois, mas não mostrou o reparo sendo executado.';
const local = createLocalInterpretation(query, service, rules);
const defaultKeys = [...evidenceCatalog(rules).keys()];

function response(sourceId: unknown, overrides: {
  group?: string; state?: string; intent?: string; keys?: string[];
} = {}) {
  const evidence = Object.fromEntries((overrides.keys ?? defaultKeys).map((key) =>
    [key, { state: 'not_mentioned', sourceIds: [] as unknown[] }]));
  evidence[overrides.group ?? during.factGroup!] = { state: overrides.state ?? 'absent', sourceIds: [sourceId] };
  return JSON.stringify({ intent: overrides.intent ?? 'report', evidence, mappings: [],
    conversation: { answer: 'Confira a evidência indicada na análise.', question: '' } });
}

function keysFrom(options?: StructuredModelRequestOptions): string[] {
  const schema = options?.responseSchema as { properties: { evidence: { properties: Record<string, unknown> } } };
  return Object.keys(schema.properties.evidence.properties);
}

function client(sourceId: unknown, group?: string): StructuredModelClient {
  return { provider: 'local', providerChain: ['local'], cacheKey: 'test-evidence',
    async request(_contents, _instruction, _limit, options) {
      const text = response(sourceId, { group, keys: keysFrom(options) });
      return { provider: 'local', status: 'ok', text };
    } };
}

describe('ficha local de evidências', () => {
  it('vincula ausência ao trecho correto sem o modelo escolher a regra', () => {
    const parsed = local.parse(response(1));
    expect(parsed?.mappings[0]).toMatchObject({ ruleId: during.id,
      sourceQuote: 'não mostrou o reparo sendo executado.', stance: 'asserted' });
  });

  it('recusa ausência sustentada por um trecho de presença', () => {
    expect(local.parse(response(0))).toBeNull();
    expect(createLocalInterpretation('A foto durante aparece na OS.', service, rules)
      .parse(response(0))).toBeNull();
  });

  it.each(['present', 'uncertain'])('estado %s não confirma ausência', (state) => {
    const parsed = local.parse(response(1, { state }));
    expect(parsed?.mappings).toEqual([]);
    expect(parsed?.canonicalPrompt).toBeNull();
  });

  it('não presume ausência daquilo que não foi mencionado', () => {
    const body = JSON.parse(response(1));
    for (const key of defaultKeys) body.evidence[key] = { state: 'not_mentioned', sourceIds: [] };
    expect(local.parse(JSON.stringify(body))?.mappings).toEqual([]);
  });

  it('mantém hipótese explícita mesmo se o modelo disser que é relato', () => {
    const request = createLocalInterpretation('Se faltar a foto durante, como fica?', service, rules);
    expect(request.parse(response(0))?.mappings[0].stance).toBe('hypothetical');
  });

  it('mantém pergunta informativa sem classificar uma OS', async () => {
    const analysis = new AebotAnalysisService({ modelClient: client(0, before.factGroup), humanizeDeterministicResponses: false });
    const result = await analysis.analyze({ serviceId: service.id, prompt: 'Precisa mesmo de foto antes de começar?', history: [] });
    expect(result.decision).toBeNull();
    expect(result.evaluation.outcome).not.toBe('decision');
  });

  it('mantém decisão nula se o modelo inventar uma ausência', async () => {
    const analysis = new AebotAnalysisService({ modelClient: client(0), humanizeDeterministicResponses: false });
    const result = await analysis.analyze({ serviceId: service.id, prompt: 'A foto durante aparece na OS.', history: [] });
    expect(result.decision).toBeNull();
  });

  it('conecta os fatos à entrada nativa do motor, sem reavaliar texto canônico', async () => {
    const promptSpy = vi.spyOn(ruleEngine, 'evaluatePrompt');
    const factsSpy = vi.spyOn(ruleEngine, 'evaluateFacts');
    try {
      const analysis = new AebotAnalysisService({ modelClient: client(1), humanizeDeterministicResponses: false });
      const result = await analysis.analyze({ serviceId: service.id, prompt: query, history: [] });
      expect(result.decision).toBe('Não Conforme');
      expect(result.evaluation.semanticMappings?.[0].sourceQuote).toBe('não mostrou o reparo sendo executado.');
      expect(factsSpy).toHaveBeenCalledWith(expect.objectContaining({ query, serviceId: service.id }));
      expect(promptSpy.mock.calls.every(([text]) => text === query)).toBe(true);
    } finally {
      promptSpy.mockRestore();
      factsSpy.mockRestore();
    }
  });

  it('separa contraste sem alterar a citação nem remover a interrogação', () => {
    expect(splitTextClauses('Tem foto antes, faltou depois. Como fica?')).toEqual([
      'Tem foto antes', 'faltou depois.', 'Como fica?',
    ]);
  });

  it.each([-1, 2, 1.5, '1', null])('recusa sourceId inválido: %s', (sourceId) => {
    expect(local.parse(response(sourceId))).toBeNull();
  });

  it('recusa grupo inexistente ou grupo obrigatório omitido', () => {
    expect(local.parse(response(1, { group: 'inventado' }))).toBeNull();
    const body = JSON.parse(response(1));
    delete body.evidence[during.factGroup!];
    expect(local.parse(JSON.stringify(body))).toBeNull();
  });

  it.each(['absent', 'present', 'uncertain'])('exige citação para o estado %s', (state) => {
    const body = JSON.parse(response(1, { state }));
    body.evidence[during.factGroup!].sourceIds = [];
    expect(local.parse(JSON.stringify(body))).toBeNull();
  });

  it('not_mentioned não aceita uma citação', () => {
    expect(local.parse(response(1, { state: 'not_mentioned' }))).toBeNull();
  });

  it('recusa citação inventada, índices repetidos e estado desconhecido', () => {
    for (const change of [
      { sourceQuote: 'Texto inventado.' }, { sourceIds: [1, 1] }, { state: 'approved' },
    ]) {
      const body = JSON.parse(response(1));
      Object.assign(body.evidence[during.factGroup!], change);
      expect(local.parse(JSON.stringify(body))).toBeNull();
    }
  });

  it('recusa IDs externos, grupos repetidos em mappings e escolha direta de agregadora', () => {
    const aggregate = rules.find((rule) => rule.matchPolicy?.minimumMatchedFactGroups)!;
    for (const ruleId of ['inventada', during.id, aggregate.id]) {
      const body = JSON.parse(response(1));
      body.mappings.push({ sourceId: 1, ruleId, stance: 'asserted' });
      expect(local.parse(JSON.stringify(body))).toBeNull();
    }
  });

  it('não escolhe automaticamente entre regras diferentes do mesmo grupo', () => {
    expect(evidenceCatalog([during, { ...during, id: 'another-rule' }]).size).toBe(0);
  });

  it('preserva o catálogo de evidências mesmo quando a recuperação trouxe só uma falta', () => {
    const request = createLocalInterpretation(query, service, [during], [], {}, rules);
    expect(keysFrom({ responseSchema: request.schema }).sort()).toEqual([...defaultKeys].sort());
    expect(request.parse(response(1))?.mappings[0].ruleId).toBe(during.id);
  });

  it('não promove um grupo de regra positiva a regra de ausência', () => {
    expect(evidenceCatalog([{ ...during, title: 'Registro válido', description: 'Registro correto',
      conditionKeywords: ['registro correto'] }]).size).toBe(0);
  });

  it('funciona com grupos arbitrários vindos dos dados, sem nomes de etapas no código', () => {
    const custom = { ...during, id: 'custom-evidence-rule', factGroup: 'documento-x' };
    const request = createLocalInterpretation('Não apresentaram o documento solicitado.', service, [custom]);
    const parsed = request.parse(response(0, { group: 'documento-x', keys: ['documento-x'] }));
    expect(parsed?.mappings[0].ruleId).toBe(custom.id);
  });

  it('mantém o contrato anterior para regras sem catálogo de evidências', () => {
    const ungrouped = { ...during, factGroup: undefined };
    const request = createLocalInterpretation(query, service, [ungrouped]);
    const parsed = request.parse(JSON.stringify({ mappings: [{ sourceId: 1, ruleId: during.id, stance: 'asserted' }] }));
    expect(parsed?.mappings[0].ruleId).toBe(during.id);
  });

  it('leva pergunta pendente e resposta curta no protocolo local', () => {
    const request = createLocalInterpretation('interna', service, rules, ['Qual tipo de equipe?'], { allowSingleTokenQuote: true });
    expect(request.prompt).toContain('Qual tipo de equipe?');
    expect(request.prompt).toContain('"sourceId":0,"text":"interna"');
  });
});
