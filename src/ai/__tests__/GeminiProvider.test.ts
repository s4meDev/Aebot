import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildEvaluationPrompt,
  buildSemanticInterpretationPrompt,
  buildServiceSystemInstruction,
} from '../PromptBuilder';
import {
  buildGeminiContents,
  GeminiProvider,
  getGeminiThinkingConfig,
  normalizeGeminiModel,
} from '../GeminiProvider';
import { ruleEngine } from '../../services/RuleEngine';
import { storageAdapter } from '../../storage/StorageAdapter';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import type { AiMessage } from '../../types';

const selectedService = ruleEngine.getServices()[0];
const duringRule = ruleEngine
  .getRulesForService(selectedService.id)
  .find((rule) => rule.conditionKeywords.includes('sem foto durante'))!;

afterEach(() => {
  storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
  storageAdapter.remove(STORAGE_KEYS.GEMINI_MODEL);
  vi.unstubAllGlobals();
});

describe('GeminiProvider', () => {
  it('envia regras orientativas ao contexto sem inventar conclusão', () => {
    const guidanceRule = ruleEngine
      .getRulesForService(selectedService.id)
      .find((rule) => rule.severity === undefined)!;
    const instruction = buildServiceSystemInstruction(
      selectedService,
      [guidanceRule],
      ruleEngine.getConclusions()
    );

    expect(instruction).toContain(`[${guidanceRule.id}]`);
    expect(instruction).toContain('Conclusão: não definida na regra');
    expect(instruction).toContain(guidanceRule.sourceReferences?.[0]);
  });

  it('não fornece conclusões oficiais ao extrator semântico', () => {
    const prompt = buildSemanticInterpretationPrompt(
      'frase livre',
      selectedService,
      ruleEngine.getRulesForService(selectedService.id)
    );

    expect(prompt).not.toContain('"severity"');
    expect(prompt).not.toContain('"priority"');
    expect(prompt).not.toContain('"guidance"');
    expect(prompt).toContain('paráfrases, sinônimos e descrições informais');
    expect(prompt).toContain('mencionar uma evidência ou ação sem afirmar');
  });

  it('não envia a pergunta atual duplicada no histórico e no prompt', () => {
    const current = 'A foto depois não foi apresentada.';
    const history: AiMessage[] = [
      { id: 'old', role: 'assistant', content: 'Resposta anterior', timestamp: '10:00' },
      { id: 'current', role: 'user', content: current, timestamp: '10:01' },
    ];
    const evaluation = ruleEngine.evaluatePrompt(current, selectedService.id);
    const augmented = buildEvaluationPrompt(current, evaluation);
    const contents = buildGeminiContents(history, current, augmented);
    const serialized = JSON.stringify(contents);

    expect(serialized.split(current).length - 1).toBe(1);
    expect(contents).toHaveLength(2);
  });

  it('modo simulado não aprova quando nenhuma regra é encontrada', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const provider = new GeminiProvider();
    const response = await provider.generateResponse(
      '',
      'A equipe chegou cedo ao endereço.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.fallbackReason).toBe('no_api_key');
    expect(response.decision).toBeNull();
    expect(response.content).toContain('Não foi possível recomendar uma conclusão');
  });

  it('explica orientação documental sem inventar classificação', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const response = await new GeminiProvider().generateResponse(
      '',
      'A foto foi feita na vertical.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.decision).toBeNull();
    expect(response.evaluation.outcome).toBe('advisory');
    expect(response.content).toContain('horizontal');
    expect(response.content).toContain('Para concluir a classificação');
  });

  it('modo simulado responde pergunta informativa sem recomendar decisão', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const response = await new GeminiProvider().generateResponse(
      '',
      'Qual é a regra da foto depois?',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.decision).toBeNull();
    expect(response.evaluation.outcome).toBe('informational');
    expect(response.content).toContain('Sobre essa dúvida');
    expect(response.content).toContain(response.evaluation.primaryRule?.id);
    expect(response.content).not.toContain('Decisão recomendada');
    expect(response.content).not.toContain('Não foi possível recomendar');
  });

  it('modo simulado conecta uma continuação explícita à pergunta anterior', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const history: AiMessage[] = [
      {
        id: 'previous-user',
        role: 'user',
        content: 'Faltou a foto antes.',
        timestamp: '10:00',
      },
      {
        id: 'previous-answer',
        role: 'assistant',
        content: 'Não Conforme.',
        timestamp: '10:01',
      },
    ];

    const response = await new GeminiProvider().generateResponse(
      '',
      'E durante também?',
      { id: selectedService.id, name: selectedService.name },
      history
    );

    expect(response.evaluation.contextApplied).toBe(true);
    expect(response.evaluation.normalizedQuery).toContain('foto antes');
    expect(response.evaluation.normalizedQuery).toContain('durante tambem');
    expect(response.decision).toBe('Reprovado');
    expect(response.content).toContain('Considerei também a pergunta anterior');
  });

  it('recalcula duas etapas ausentes mesmo quando a etapa durante é descrita por uma ação', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const history: AiMessage[] = [
      {
        id: 'previous-user',
        role: 'user',
        content: 'Não mostrou o aperto da virola.',
        timestamp: '10:00',
      },
      {
        id: 'previous-answer',
        role: 'assistant',
        content: 'Não Conforme.',
        timestamp: '10:01',
      },
    ];

    const response = await new GeminiProvider().generateResponse(
      '',
      'Mas não tem foto antes também.',
      { id: selectedService.id, name: selectedService.name },
      history
    );

    expect(response.evaluation.contextApplied).toBe(true);
    expect(response.decision).toBe('Reprovado');
    expect(response.evaluation.primaryRule?.title).toBe('Ausência de duas ou mais etapas');
    expect(response.evaluation.primaryRule?.supportingRuleIds).toHaveLength(2);
    expect(response.content).toContain('Não foi evidenciada a execução do serviço');
  });

  it('não reutiliza histórico em uma nova pergunta independente', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const history: AiMessage[] = [{
      id: 'previous-user',
      role: 'user',
      content: 'Sem foto depois.',
      timestamp: '10:00',
    }];

    const response = await new GeminiProvider().generateResponse(
      '',
      'Qual é a regra da foto antes?',
      { id: selectedService.id, name: selectedService.name },
      history
    );

    expect(response.evaluation.contextApplied).toBe(false);
    expect(response.evaluation.outcome).toBe('informational');
    expect(response.decision).toBeNull();
  });

  it('troca o tema numa pergunta curta sem herdar irregularidade anterior', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const history: AiMessage[] = [{
      id: 'previous-user',
      role: 'user',
      content: 'Sem foto depois.',
      timestamp: '10:00',
    }];

    const response = await new GeminiProvider().generateResponse(
      '',
      'E antes?',
      { id: selectedService.id, name: selectedService.name },
      history
    );

    expect(response.evaluation.contextApplied).toBe(false);
    expect(response.evaluation.outcome).toBe('informational');
    expect(response.evaluation.primaryRule?.title).toContain('antes');
    expect(response.decision).toBeNull();
  });

  it('recalcula o mesmo caso usando a correção mais recente', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const history: AiMessage[] = [{
      id: 'previous-user',
      role: 'user',
      content: 'Faltaram as fotos antes e durante.',
      timestamp: '10:00',
    }];

    const response = await new GeminiProvider().generateResponse(
      '',
      'Na verdade, a foto durante foi apresentada.',
      { id: selectedService.id, name: selectedService.name },
      history
    );

    expect(response.evaluation.contextApplied).toBe(true);
    expect(response.decision).toBe('Não Conforme');
    expect(response.content).toContain('Considerei a correção mais recente');
  });

  it('confirma a correção mesmo quando ainda não há dados para nova conclusão', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const history: AiMessage[] = [{
      id: 'previous-user',
      role: 'user',
      content: 'Sem foto depois.',
      timestamp: '10:00',
    }];

    const response = await new GeminiProvider().generateResponse(
      '',
      'Corrigindo, a foto depois foi apresentada.',
      { id: selectedService.id, name: selectedService.name },
      history
    );

    expect(response.evaluation.outcome).toBe('informational');
    expect(response.evaluation.contextApplied).toBe(true);
    expect(response.decision).toBeNull();
    expect(response.content).toContain('correção mais recente foi considerada');
    expect(response.content).toContain('Informe os demais fatos do caso');
    expect(response.content).not.toContain('atualize a regra necessária');
  });

  it('rejeita identificador de modelo inseguro e usa o padrão', () => {
    expect(normalizeGeminiModel('../../modelo?key=outra')).toBe('gemini-flash-latest');
    expect(normalizeGeminiModel('gemini-2.5-flash')).toBe('gemini-flash-latest');
    expect(normalizeGeminiModel('gemini-modelo_seguro.1')).toBe('gemini-modelo_seguro.1');
  });

  it('limita o raciocínio interno dos modelos Flash sem afetar modelos antigos', () => {
    expect(getGeminiThinkingConfig('gemini-flash-latest')).toEqual({
      thinkingLevel: 'MINIMAL',
    });
    expect(getGeminiThinkingConfig('gemini-flash-lite-latest')).toEqual({
      thinkingLevel: 'MINIMAL',
    });
    expect(getGeminiThinkingConfig('gemini-3.5-flash')).toEqual({
      thinkingLevel: 'MINIMAL',
    });
    expect(getGeminiThinkingConfig('gemini-2.5-flash-lite')).toEqual({
      thinkingBudget: 0,
    });
    expect(getGeminiThinkingConfig('gemini-2.0-flash')).toBeUndefined();
  });

  it('repete uma vez quando o Gemini retorna limitação temporária', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            justification: 'A evidência final obrigatória não foi apresentada.',
            guidance: 'Siga a orientação cadastrada para a ausência confirmada.',
          }) }] } }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await new GeminiProvider().generateResponse(
      '',
      'Sem foto depois.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.provider).toBe('gemini');
    expect(response.decision).toBe('Reprovado');
  });

  it('diferencia cota temporariamente esgotada de erro genérico', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '0' }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      'Expressão inteiramente desconhecida da base.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.fallbackReason).toBe('rate_limited');
    expect(response.decision).toBeNull();
    expect(response.content).toContain('limite temporário do provedor de IA');
  });

  it('usa o modelo reserva somente quando o principal atinge a cota', async () => {
    const query = 'Não apareceu o momento em que deram torque na virola.';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            mappings: [{
              ruleId: duringRule.id,
              sourceQuote: 'Não apareceu o momento em que deram torque na virola',
              canonicalExpression: 'sem foto durante',
              stance: 'asserted',
            }],
          }) }] } }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider(ruleEngine, {
      getApiKey: () => 'test-key',
      getModel: () => 'gemini-flash-latest',
      getFallbackModel: () => 'gemini-flash-lite-latest',
    });

    const response = await provider.generateResponse(
      '',
      query,
      { id: selectedService.id, name: selectedService.name }
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/gemini-flash-latest:');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/gemini-flash-lite-latest:');
    expect(response.provider).toBe('gemini');
    expect(response.decision).toBe('Não Conforme');
  });

  it('poupa a cota quando o backend já possui uma avaliação determinística', async () => {
    const fetchMock = vi.fn();
    const provider = new GeminiProvider(ruleEngine, {
      getApiKey: () => 'test-key',
      humanizeDeterministicResponses: false,
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await provider.generateResponse(
      '',
      'Sem foto depois.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.provider).toBe('simulated');
    expect(response.fallbackReason).toBeUndefined();
    expect(response.decision).toBe('Reprovado');
  });

  it('não chama IA quando o serviço ainda não possui regras próprias', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider(ruleEngine, {
      getApiKey: () => 'test-key',
    });

    const response = await provider.generateResponse(
      '',
      'O acabamento ficou correto.',
      { id: 'desobstrucao-ramal-agua', name: 'Desobstrução de Ramal de Água' }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.decision).toBeNull();
    expect(response.evaluation.insufficiencyReason).toBe('service_rules_pending');
  });

  it('preserva orientação crítica reconhecida sem marcar falha semântica', async () => {
    const provider = new GeminiProvider(ruleEngine, {
      getApiKey: () => 'test-key',
      humanizeDeterministicResponses: false,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await provider.generateResponse(
      '',
      'O desdobro executado ficou sem foto durante.',
      { id: 'reparo-rede-agua-asfalto', name: 'Reparo de Rede de Água - Asfalto' }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.decision).toBeNull();
    expect(response.evaluation.insufficiencyReason).toBe('missing_information');
    expect(response.content).toContain('Atenção crítica');
    expect(response.content).not.toContain('interpretação semântica não pôde');
  });

  it('devolve a ação Executado ou Posterior quando falta o desdobro de repavimentação', async () => {
    const response = await new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    }).generateResponse(
      '',
      'Falta de desdobro para Repavimentação Calçada.',
      { id: 'reparo-cavalete', name: 'Reparo de Cavalete de Água' }
    );

    expect(response.decision).toBe('Não Conforme');
    expect(response.content).toContain('Adicional Executado');
    expect(response.content).toContain('Adicional Posterior');
    expect(response.content).not.toContain('interpretação semântica não pôde');
  });

  it('responde diretamente para retirar repavimentação sem evidência de vala', async () => {
    const response = await new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    }).generateResponse(
      '',
      'Sem foto da vala feita na OS, então tiro o desdobro de repavimentação?',
      { id: 'reparo-cavalete', name: 'Reparo de Cavalete de Água' }
    );

    expect(response.decision).toBeNull();
    expect(response.evaluation.outcome).toBe('advisory');
    expect(response.evaluation.primaryRule?.id).toBe('RULE-PARAM-ESCAVACAO-01');
    expect(response.content).toContain('Sim.');
    expect(response.content).toContain('retire o desdobro');
    expect(response.content).toContain('Sem foto ou outra evidência de vala');
    expect(response.content).not.toContain('Ausência de desdobro obrigatório');
  });

  it('aplica ao reparo de ramal as conclusões comuns sem cobrar chassi', async () => {
    const provider = new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    });
    const service = {
      id: 'reparo-ramal-agua-calcada',
      name: 'Reparo de Ramal de Água - Calçada',
    };

    const missingDuring = await provider.generateResponse(
      '',
      'Sem foto durante o reparo de ramal.',
      service
    );
    const missingChassis = await provider.generateResponse(
      '',
      'O reparo de ramal está sem foto do chassi e do hidrômetro.',
      service
    );

    expect(missingDuring.decision).toBe('Não Conforme');
    expect(missingDuring.evaluation.primaryRule?.id).toBe('RULE-RR-04');
    expect(missingChassis.decision).toBeNull();
    expect(missingChassis.evaluation.primaryRule?.id).toBe('RULE-RR-INFO-04');
    expect(missingChassis.content).toContain('não é obrigatória');
  });

  it('orienta pavimento no ramal e preserva a exceção do Ramal Terra', async () => {
    const provider = new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    });
    const paved = await provider.generateResponse(
      '',
      'Abriu o asfalto para fazer o reparo de ramal.',
      { id: 'reparo-ramal-agua-asfalto', name: 'Reparo de Ramal de Água - Asfalto' }
    );
    const earth = await provider.generateResponse(
      '',
      'Ramal Terra precisa de desdobro de repavimentação?',
      { id: 'reparo-ramal-agua-terra', name: 'Reparo de Ramal de Água - Terra' }
    );

    expect(paved.decision).toBeNull();
    expect(paved.content).toContain('reaterro e a repavimentação');
    expect(earth.decision).toBeNull();
    expect(earth.content).toContain('não cobre repavimentação');
  });

  it('pede a superintendência e usa a resposta curta para completar o caso', async () => {
    const provider = new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    });
    const service = {
      id: 'reparo-ramal-agua-asfalto',
      name: 'Reparo de Ramal de Água - Asfalto',
    };
    const question = 'Qual desdobro de pavimento devo usar?';
    const first = await provider.generateResponse('', question, service, []);
    const history: AiMessage[] = [
      { id: 'regional-user', role: 'user', content: question, timestamp: '10:00' },
      { id: 'regional-assistant', role: 'assistant', content: first.content, timestamp: '10:01' },
    ];
    const completed = await provider.generateResponse('', 'Norte', service, history);

    expect(first.decision).toBeNull();
    expect(first.evaluation.outcome).toBe('advisory');
    expect(first.content).toContain('Qual é a superintendência da OS');
    expect(completed.evaluation.contextApplied).toBe(true);
    expect(completed.evaluation.outcome).toBe('informational');
    expect(completed.evaluation.primaryRule?.id).toBe(
      'RULE-PARAM-ASFALTO-NORTE-CENTROSUL-01'
    );
    expect(completed.content).toContain('desdobre o pavimento como Concreto');
  });

  it('humaniza a metragem de rede sem alterar a Não Conformidade', async () => {
    const response = await new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    }).generateResponse(
      '',
      'Colocaram metragem no formulário, mas não mostraram medindo a rede.',
      { id: 'reparo-rede-agua-asfalto', name: 'Reparo de Rede de Água - Asfalto' }
    );

    expect(response.decision).toBe('Não Conforme');
    expect(response.evaluation.primaryRule?.id).toBe('RULE-REDEAGUA-01');
    expect(response.content).toContain('Zere a metragem');
  });

  it('aplica a falta geral de parametrização sem depender de um serviço específico', async () => {
    const response = await new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    }).generateResponse(
      '',
      'Fez outro serviço mas não colocou no adicional executado.',
      { id: 'implantacao-ligacao-agua', name: 'Implantação de Ligação de Água' }
    );

    expect(response.decision).toBe('Não Conforme');
    expect(response.content).toContain('Adicional Executado');
    expect(response.evaluation.primaryRule?.id).toBe('RULE-PARAM-GERAL-01');
  });

  it('reprova quando não existe possibilidade de troca correta', async () => {
    const response = await new GeminiProvider(ruleEngine, {
      humanizeDeterministicResponses: false,
    }).generateResponse(
      '',
      'O sistema não permite trocar para o serviço correto.',
      { id: 'reparo-rede-agua-asfalto', name: 'Reparo de Rede de Água - Asfalto' }
    );

    expect(response.decision).toBe('Reprovado');
    expect(response.content).toContain('Não há a possibilidade de troca do serviço');
  });

  it('oferece orientação fundamentada sem aceitar decisão inventada pelo modelo', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          justification: 'A OS está Conforme.',
          guidance: 'Pode aprovar.',
        }) }] } }],
      }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      'A foto foi feita na vertical.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.fallbackReason).toBe('invalid_response');
    expect(response.evaluation.outcome).toBe('advisory');
    expect(response.decision).toBeNull();
    expect(response.content).toContain('horizontal');
  });

  it('mantém a decisão determinística quando o modelo tenta alterá-la', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          justification: 'O serviço está Conforme.',
          guidance: 'Aprove a ordem.',
        }) }] } }],
      }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      'Sem foto depois.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.fallbackReason).toBe('invalid_response');
    expect(response.decision).toBe('Reprovado');
    expect(response.content).toContain('Reprovado');
  });

  it('usa interpretação semântica aterrada quando a frase livre não tem match lexical', async () => {
    const query = 'Não apareceu o momento em que deram torque na virola.';
    expect(ruleEngine.evaluatePrompt(query, selectedService.id).decision).toBeNull();
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          decision: 'Conforme',
          mappings: [{
            ruleId: duringRule.id,
            sourceQuote: 'Não apareceu o momento em que deram torque na virola',
            canonicalExpression: 'sem foto durante',
            stance: 'asserted',
          }],
        }) }] } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider();
    const response = await provider.generateResponse(
      '',
      query,
      { id: selectedService.id, name: selectedService.name }
    );
    const repeated = await provider.generateResponse(
      '',
      query,
      { id: selectedService.id, name: selectedService.name }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MINIMAL' });
    expect(response.provider).toBe('gemini');
    expect(response.decision).toBe('Não Conforme');
    expect(response.evaluation.semanticInterpretationApplied).toBe(true);
    expect(response.evaluation.semanticMappings?.[0].ruleId).toBe(duringRule.id);
    expect(response.evaluation.confidence).not.toBe('alta');
    expect(response.content).toContain('Não Conforme');
    expect(repeated.decision).toBe(response.decision);
    expect(repeated.evaluation.semanticInterpretationApplied).toBe(true);
  });

  it('rejeita mapeamento semântico inventado e mantém decision null', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          mappings: [{
            ruleId: 'REGRA-INVENTADA',
            sourceQuote: 'situação totalmente desconhecida',
            canonicalExpression: 'aprovar por conhecimento geral',
            stance: 'asserted',
          }],
        }) }] } }],
      }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      'Situação totalmente desconhecida.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.fallbackReason).toBe('invalid_response');
    expect(response.decision).toBeNull();
    expect(response.evaluation.semanticInterpretationApplied).not.toBe(true);
    expect(response.evaluation.insufficiencyReason).toBe('semantic_unavailable');
    expect(response.content).not.toContain('cadastre ou atualize');
  });

  it('distingue ausência real de regra de falha da interpretação semântica', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"mappings":[]}' }] } }],
      }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      'Situação realmente fora do catálogo.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('gemini');
    expect(response.decision).toBeNull();
    expect(response.evaluation.semanticInterpretationApplied).toBe(true);
    expect(response.evaluation.semanticMappings).toEqual([]);
    expect(response.evaluation.insufficiencyReason).toBe('no_matching_rule');
  });

  it('interpreta semanticamente uma pergunta sem classificar uma OS real', async () => {
    const query = 'Quero entender quando some o registro do momento do torque.';
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          mappings: [{
            ruleId: duringRule.id,
            sourceQuote: 'quando some o registro do momento do torque',
            canonicalExpression: 'sem foto durante',
            stance: 'informational',
          }],
        }) }] } }],
      }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      query,
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('gemini');
    expect(response.evaluation.outcome).toBe('informational');
    expect(response.decision).toBeNull();
    expect(response.content).not.toContain('Decisão recomendada');
  });

  it('humaniza regra informativa sem classificar uma OS real', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          justification: 'A regra prevê Reprovado somente se a falta da foto final for confirmada.',
          guidance: 'Confirme a evidência na Ordem de Serviço antes de classificar.',
        }) }] } }],
      }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      'Qual é a regra da foto depois?',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('gemini');
    expect(response.decision).toBeNull();
    expect(response.evaluation.outcome).toBe('informational');
    expect(response.content).toContain('Sobre essa dúvida');
    expect(response.content).not.toContain('Decisão recomendada');
  });

  it('rejeita conclusão criada pelo Gemini para orientação sem severidade', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          justification: 'O hidrômetro avariado torna a OS Conforme.',
          guidance: 'Aprove a ordem.',
        }) }] } }],
      }),
    }));

    const response = await new GeminiProvider().generateResponse(
      '',
      'Quem deve trocar um hidrômetro quebrado?',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.fallbackReason).toBe('invalid_response');
    expect(response.evaluation.outcome).toBe('informational');
    expect(response.decision).toBeNull();
    expect(response.content).toContain('setor Comercial');
  });

  it('ausência de regra permanece decision null no contrato do provider', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const response = await new GeminiProvider().generateResponse(
      '',
      'Dúvida sem relação com as regras cadastradas.',
      { id: selectedService.id, name: selectedService.name }
    );
    expect(response.evaluation.hasSufficientEvidence).toBe(false);
    expect(response.evaluation.decision).toBeNull();
    expect(response.decision).toBeNull();
  });

  it('pede fatos adicionais quando reconhece o tema mas não pode decidir', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const response = await new GeminiProvider().generateResponse(
      '',
      'A foto depois foi apresentada.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.evaluation.insufficiencyReason).toBe('missing_information');
    expect(response.decision).toBeNull();
    expect(response.content).toContain('Informe quais evidências foram apresentadas');
    expect(response.content).not.toContain('cadastre ou atualize a regra');
  });

  it('motor genérico não contém IDs nem textos de um serviço específico', () => {
    const files = ['../../services/RuleEngine.ts', '../../services/RuleRetriever.ts', '../../services/ConflictResolver.ts'];
    const source = files
      .map((relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/RULE-RC/i);
    expect(source).not.toMatch(/Reparo de Cavalete/i);
  });

  it('mede reaproveitamento do cache sem guardar texto no diagnóstico', async () => {
    const query = 'O momento do torque sumiu do relatório.';
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          mappings: [{
            ruleId: duringRule.id,
            sourceQuote: query,
            canonicalExpression: 'sem foto durante',
            stance: 'asserted',
          }],
        }) }] } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider();

    await provider.generateResponse('', query, { id: selectedService.id, name: selectedService.name });
    await provider.generateResponse('', query, { id: selectedService.id, name: selectedService.name });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider.getDiagnostics()).toMatchObject({
      semanticCacheEntries: 1,
      semanticCacheHits: 1,
      semanticCacheMisses: 1,
      modelRequests: 1,
    });
    expect(JSON.stringify(provider.getDiagnostics())).not.toContain(query);
  });

  it('não usa chave Gemini local no pacote empresarial', async () => {
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, 'test-key');
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({ host_permissions: ['https://aebot.example/*'] }),
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await new GeminiProvider().generateResponse(
      '',
      'Dúvida sem relação com as regras cadastradas.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.provider).toBe('simulated');
    expect(response.decision).toBeNull();
    expect(response.fallbackReason).toBe('no_api_key');
  });
});
