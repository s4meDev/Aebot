import { describe, expect, it } from 'vitest';
import type { AiMessage } from '../../types';
import {
  parseNewCaseCommand,
  resolveContextualQuery,
} from '../ConversationContextResolver';

const history: AiMessage[] = [
  { id: 'welcome', role: 'assistant', content: 'Olá', timestamp: '10:00' },
  { id: 'previous-user', role: 'user', content: 'Faltou a foto antes.', timestamp: '10:01' },
  { id: 'previous-answer', role: 'assistant', content: 'Resposta', timestamp: '10:02' },
];

describe('ConversationContextResolver', () => {
  it('liga continuação explícita somente à última mensagem do analista', () => {
    const result = resolveContextualQuery('E durante também?', history);
    expect(result).toEqual({
      query: 'Faltou a foto antes. faltou durante também?',
      contextApplied: true,
      mode: 'continuation',
      sourceMessageId: 'previous-user',
    });
  });

  it('não contamina uma nova pergunta independente', () => {
    const result = resolveContextualQuery('Qual é a regra da foto do chassi?', history);
    expect(result).toEqual({
      query: 'Qual é a regra da foto do chassi?',
      contextApplied: false,
    });
  });

  it('não herda fatos numa consulta curta que apenas troca o tema', () => {
    const result = resolveContextualQuery('E antes?', history);
    expect(result.contextApplied).toBe(false);
    expect(result.query).toBe('E antes?');
  });

  it('não interpreta pronome reflexivo como continuação', () => {
    expect(resolveContextualQuery('Como se analisa esse serviço?', history).contextApplied).toBe(false);
  });

  it('não cria contexto quando ainda não existe pergunta anterior', () => {
    const result = resolveContextualQuery('E durante também?', [history[0]]);
    expect(result.contextApplied).toBe(false);
    expect(result.query).toBe('E durante também?');
  });

  it('preserva o contexto acumulado em uma terceira pergunta curta', () => {
    const chainedHistory: AiMessage[] = [
      ...history,
      {
        id: 'second-user',
        role: 'user',
        content: 'E durante também?',
        contextQuery: 'faltou a foto antes e durante tambem',
        timestamp: '10:03',
      },
    ];

    const result = resolveContextualQuery('E depois também?', chainedHistory);
    expect(result.contextApplied).toBe(true);
    expect(result.query).toBe('faltou a foto antes e durante tambem. faltou depois também?');
    expect(result.sourceMessageId).toBe('second-user');
  });

  it('distingue uma correção do mesmo caso', () => {
    const result = resolveContextualQuery('Na verdade, a foto antes foi apresentada.', history);
    expect(result.contextApplied).toBe(true);
    expect(result.mode).toBe('correction');
  });

  it('liga uma resposta curta à devolutiva feita pelo AEBOT', () => {
    const clarificationHistory: AiMessage[] = [
      {
        id: 'regional-question',
        role: 'user',
        content: 'Qual desdobro de pavimento devo usar?',
        timestamp: '10:10',
      },
      {
        id: 'clarification',
        role: 'assistant',
        content: 'Para concluir a classificação:\nInforme a superintendência da OS.',
        pendingInformation: ['Informe a superintendência da OS.'],
        timestamp: '10:11',
      },
    ];

    expect(resolveContextualQuery('Norte', clarificationHistory)).toEqual({
      query: 'Qual desdobro de pavimento devo usar. Informação solicitada: Norte',
      contextApplied: true,
      mode: 'continuation',
      sourceMessageId: 'regional-question',
      clarificationApplied: true,
      clarificationQuestions: ['Informe a superintendência da OS.'],
    });
  });

  it('não liga uma resposta curta quando o AEBOT não pediu esclarecimento', () => {
    expect(resolveContextualQuery('Norte', history).contextApplied).toBe(false);
  });

  it.each([
    'Outro caso',
    'É outro caso',
    'Vamos analisar outro caso',
    'Vamos para outro caso',
    'Próximo caso',
    'Trocar de caso',
    'Limpar o chat',
  ])(
    'reconhece o comando de novo caso: %s',
    (command) => {
      expect(parseNewCaseCommand(command)).toEqual({ isNewCase: true, remainingPrompt: undefined });
    }
  );

  it('separa fatos informados junto ao comando de novo caso', () => {
    expect(parseNewCaseCommand('Outro caso: sem foto depois')).toEqual({
      isNewCase: true,
      remainingPrompt: 'sem foto depois',
    });
  });

  it('não confunde texto de negócio com comando de conversa', () => {
    expect(parseNewCaseCommand('O serviço foi executado em outro endereço')).toEqual({
      isNewCase: false,
    });
  });

  it.each([
    'É o mesmo caso, mas a foto antes foi apresentada.',
    'No mesmo caso, corrigindo a foto durante.',
    'Mudei uma informação: a foto depois foi apresentada.',
  ])('mantém contexto em formas naturais de corrigir o mesmo caso: %s', (command) => {
    const result = resolveContextualQuery(command, history);
    expect(result.contextApplied).toBe(true);
    expect(result.mode).toBe('correction');
  });
});
