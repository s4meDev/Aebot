import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalInterpretation } from '../LocalInterpretation';
import { ruleEngine } from '../../services/RuleEngine';
import { AebotAnalysisService } from '../../services/AnalysisService';
import { LocalModelClient } from '../../../desktop/LocalModelClient';

const service = ruleEngine.getServices().find((item) => item.id === 'repavimentacao-asfalto-ate-1m2')!;
const rules = ruleEngine.getRulesForService(service.id);
const request = (query: string) => createLocalInterpretation(query, service, rules, [], {}, rules, 'compact');
const response = (ruleId: string, sourceId = 0, stance = 'asserted') => JSON.stringify({
  mappings: [{ sourceId, ruleId, stance }], conversation: { answer: '', question: '' },
});

afterEach(() => vi.unstubAllGlobals());

describe('interpretação compacta do Qwen', () => {
  it('pergunta contexto já identificado sem chamar a IA e aceita interna/terceirizada no mesmo caso', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const model = new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'sintetico' }));
    const analysis = new AebotAnalysisService({ modelClient: model, humanizeDeterministicResponses: false });
    const first = await analysis.analyze({ serviceId: service.id, prompt: 'Sem aferição da vala.', history: [] });
    expect(first.decision).toBeNull();
    expect(first.evaluation.advisory?.missingInformation?.length).toBeGreaterThan(0);
    const history = [{ id: 'u', role: 'user' as const, content: 'Sem aferição da vala.', timestamp: '09:00' },
      { id: 'a', role: 'assistant' as const, content: first.content, timestamp: '09:01',
        pendingInformation: first.evaluation.advisory?.missingInformation }];
    expect((await analysis.analyze({ serviceId: service.id, prompt: 'interna', history })).decision).toBe('Não Conforme');
    expect((await analysis.analyze({ serviceId: service.id, prompt: 'terceirizada', history })).decision).toBe('Reprovado');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserva todas as classificatórias atômicas sem gerar estados não mencionados', () => {
    const compact = createLocalInterpretation('Relato sintético.', service, [rules[0]], [], {}, rules, 'compact');
    const schema = compact.schema as { properties: Record<string, unknown> };
    expect(schema.properties).not.toHaveProperty('evidence');
    for (const rule of rules.filter((item) => item.severity && !item.matchPolicy?.minimumMatchedFactGroups)) {
      expect(compact.prompt).toContain(rule.id);
    }
    for (const rule of rules.filter((item) => item.matchPolicy?.minimumMatchedFactGroups)) {
      expect(compact.prompt).not.toContain(rule.id);
    }
  });

  it('reduz o prompt sem cortar contexto obrigatório', () => {
    const compact = request('Não mostraram o resultado final.');
    const previous = createLocalInterpretation('Não mostraram o resultado final.', service, rules);
    // Não retiro condições para atingir uma porcentagem arbitrária de redução.
    // O contrato ainda é menor; latência é medida com inferência real.
    expect(compact.prompt.length).toBeLessThan(previous.prompt.length);
    expect(compact.prompt).toContain('relatedEvidence');
    expect(compact.prompt).toContain('matchPolicy');
    expect(compact.prompt).toContain('mandatoryConditionGroups');
    expect(compact.prompt).toContain('não apenas contém a palavra');
  });

  it.each([
    ['Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.', 'RULE-ASF-FOTO-DEPOIS-01'],
    ['Conferi no SCAE e vi que esse mesmo trecho de asfalto já tinha sido feito e encerrado em outra ordem.', 'RULE-ASF-DUPLICIDADE-01'],
    ['Usaram trena, só que pelas imagens ninguém consegue saber o tamanho real do pedaço asfaltado.', 'RULE-ASF-TRENA-01'],
  ])('leva a interpretação validada ao motor: %s', (query, id) => {
    // Aqui testamos o contrato com uma resposta fornecida, não o acerto do modelo real.
    const parsed = request(query).parse(response(id));
    expect(parsed?.mappings[0].ruleId).toBe(id);
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: parsed!.mappings }).decision).toBe('Reprovado');
  });

  it.each(['inventada', 'RULE-RC-01', 'RULE-ASF-FOTOS-COMBINADAS-01'])('recusa ID não permitido: %s', (id) => {
    expect(request('Sem fotos.').parse(response(id))).toBeNull();
  });

  it.each([-1, 99, 0.5])('recusa trecho inexistente: %s', (id) => {
    expect(request('Sem resultado final.').parse(response('RULE-ASF-FOTO-DEPOIS-01', id))).toBeNull();
  });

  it('não aceita citação livre nem campos fora do contrato', () => {
    const compact = request('Sem resultado final.');
    for (const position of ['top', 'mapping', 'conversation']) {
      const body = JSON.parse(response('RULE-ASF-FOTO-DEPOIS-01'));
      if (position === 'top') body.decision = 'Conforme';
      if (position === 'mapping') body.mappings[0].sourceQuote = 'inventado';
      if (position === 'conversation') body.conversation.ruleId = 'inventada';
      expect(compact.parse(JSON.stringify(body))).toBeNull();
    }
  });

  it('não transforma presença declarada em ausência', () => {
    const parsed = request('Mostrou foto depois.').parse(response('RULE-ASF-FOTO-DEPOIS-01'));
    expect(parsed?.mappings[0].stance).toBe('negated_or_present');
  });

  it.each(['Mandaram imagens de como ficou o asfalto pronto.', 'Dá para enxergar o resultado final.'])
    ('não aceita ausência inventada pelo modelo sobre envio ou visibilidade: %s', (query) => {
      const parsed = request(query).parse(response('RULE-ASF-FOTO-DEPOIS-01'));
      expect(parsed?.mappings[0].stance).toBe('negated_or_present');
      expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: parsed!.mappings }).decision).toBeNull();
    });

  it('não inverte a ausência ao ampliar os verbos de envio', () => {
    const query = 'Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.';
    const parsed = request(query).parse(response('RULE-ASF-FOTO-DEPOIS-01', 0, 'negated_or_present'));
    expect(parsed?.mappings[0].stance).toBe('asserted');
  });

  it('não transforma inexistência declarada em ocorrência de uma irregularidade', () => {
    const query = 'Consultei no Field e confirmei que não existe outra ordem encerrada para esse mesmo trecho.';
    expect(request(query).parse(response('RULE-ASF-DUPLICIDADE-01'))).toBeNull();
  });

  it('a escolha do modelo não cria vínculo de equipe', () => {
    const query = 'Não consegui conferir a aferição.';
    const parsed = request(query).parse(response('RULE-PAV-AFERICAO-INTERNA-01'));
    expect(parsed).not.toBeNull();
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: parsed!.mappings }).decision).toBeNull();
  });

  it('a escolha do modelo não transforma a simples menção de trena em reprovação', () => {
    const query = 'Usaram trena.';
    const parsed = request(query).parse(response('RULE-ASF-TRENA-01'));
    expect(parsed).not.toBeNull();
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: parsed!.mappings }).decision).toBeNull();
  });

  it('corrige consulta inventada pelo modelo quando o relato afirma a ausência', () => {
    const query = 'Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.';
    const parsed = request(query).parse(response('RULE-ASF-FOTO-DEPOIS-01', 0, 'informational'));
    expect(parsed?.mappings[0].stance).toBe('asserted');
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: parsed!.mappings }).decision).toBe('Reprovado');
  });

  it('o cliente real seleciona o contrato compacto no fluxo compartilhado', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{
      message: { content: response('RULE-ASF-FOTO-DEPOIS-01') }, finish_reason: 'stop',
    }] })));
    vi.stubGlobal('fetch', fetch);
    const model = new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'sintetico' }), { indexed: false });
    const analysis = new AebotAnalysisService({ modelClient: model, humanizeDeterministicResponses: false });
    const result = await analysis.analyze({ serviceId: service.id,
      prompt: 'Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.', history: [] });
    expect(result.decision).toBe('Reprovado');
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.response_format.schema.properties).not.toHaveProperty('evidence');
    expect(body.messages[0].content).toContain('RULE-ASF-FOTO-DEPOIS-01');
    expect(body.messages.at(-1).content).not.toContain('RULE-ASF-FOTO-DEPOIS-01');
  });
  it('mantém o prefixo classificatório estável entre relatos e seleções de orientação', () => {
    const first = createLocalInterpretation('Relato um.', service, [rules[0]], [], {}, rules, 'compact');
    const second = createLocalInterpretation('Relato dois.', service, rules.slice(2), ['Pergunta sintética?'], {}, rules, 'compact');
    expect(first.systemInstruction).toBe(second.systemInstruction);
    expect(first.inputPrompt).not.toBe(second.inputPrompt);
    expect(first.systemInstruction).not.toContain('Relato um.');
    expect(second.systemInstruction).not.toContain('Pergunta sintética?');
  });
});
