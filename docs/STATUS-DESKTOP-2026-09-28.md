# Evolução do motor e revisão — 28/09/2026

## O que foi feito

Separei a entrada de texto da entrada de fatos interpretados, mantendo um único motor de decisão. Antes, a interpretação da IA virava uma frase montada e passava novamente pela busca de regras. Agora, `RuleEngine.evaluateFacts` recebe o relato original, o serviço e os mapeamentos com suas citações.

O motor revalida os IDs, as expressões permitidas, a intenção e a origem das citações. A expressão de uma regra não aciona outra só por coincidência de palavras. Condições obrigatórias, sinais contrários e exceções são conferidos no relato original, não preenchidos pelo texto da própria regra.

Também corrigi a combinação de regras: a segunda passagem respeita as restrições da regra agregadora. Citações repetidas do mesmo grupo não contam como fatos diferentes. O modelo não escolhe diretamente uma regra agregadora; o motor registra as regras-base que a sustentam.

As entradas de texto e de fatos compartilham ranking, conflitos, resultado e orientação. Desktop, extensão e APIs legadas continuam usando o mesmo núcleo. Não alterei regras de negócio, o modelo, a interface ou a política de privacidade nesta etapa.

## Onde está cada mudança

- `src/types.ts`: contrato `SemanticEvaluationInput`.
- `src/services/RuleEngine.ts`: entrada `evaluateFacts`, revalidação e avaliação final compartilhada.
- `src/services/RuleRetriever.ts`: matching dos mapeamentos e composição de fatos com restrições.
- `src/services/SemanticInterpreter.ts`: comentário de compatibilidade para `canonicalPrompt`; o campo continua existindo, mas não decide mais a análise.
- `src/ai/GeminiProvider.ts`: orquestração compartilhada passa os fatos ao motor. O nome histórico não significa que o desktop acesse o Gemini.
- `src/services/__tests__/StructuredEvaluation.test.ts`: 25 testes da entrada estruturada.
- `src/ai/__tests__/LocalInterpretation.test.ts`: teste de integração garantindo que o relato não é substituído por uma frase canônica.

Atualizei README, arquitetura, ADR, Kanban, plano de validação e instruções permanentes. Os comentários explicam o motivo das proteções, sem repetir cada linha de código. Os créditos de Pedro Lucas Botelho permanecem no final do README. Nenhum arquivo foi removido.

## Testes executados

| Verificação | Resultado |
| --- | --- |
| Baseline antes da mudança | 413 testes aprovados, 1 ignorado; typecheck e build desktop aprovados |
| Suíte final `npm.cmd test` | 439 aprovados, 1 ignorado; acréscimo de 26 testes nesta etapa |
| `npm.cmd run typecheck` | Aprovado para frontend, ferramentas, Node e Worker |
| `npm.cmd run desktop:smoke` | Build/TypeScript desktop aprovados; Electron real validou isolamento, IPC, catálogo e análise determinística |
| `npm.cmd run build` e `build:server` | Aprovados |
| `npm.cmd run build:worker` | Dry-run aprovado, sem publicação |
| Validação MV3 e bundle Node | Aprovada; sem segredos reconhecidos pelo verificador do bundle |
| `npm.cmd run rules:audit` | Base 2.14.0 íntegra: 36 serviços, 77 regras |
| `git diff --check` | Sem erro de espaços; avisos de conversão LF/CRLF |

O primeiro dry-run do Worker encontrou bloqueio de acesso a arquivos pelo sandbox. A repetição autorizada fora dessa restrição passou. Não foi um erro do código nem houve deploy. O build desktop ainda avisa sobre a opção depreciada `inlineDynamicImports`; ela não impediu a compilação.

A busca por padrões conhecidos de chave não encontrou correspondências nos caminhos versionados verificados. Isso é uma checagem preventiva, não uma certificação de segurança completa. Nenhuma credencial foi adicionada.

## O que o Qwen real mostrou

Executei dois recortes no perfil padrão `direct`, usando o mesmo modelo local e sem alterar a base para encaixar as perguntas.

| Recorte do corpus | Resultado | Chamadas à IA | Observação |
| --- | --- | --- | --- |
| Índices 72–77 | 6/6 | 4 | Presença, perguntas e hipóteses preservadas; dois casos foram determinísticos |
| Índices 66–71 | 4/6 | 2 | Duas paráfrases ficaram sem a conclusão esperada; quatro acertos foram determinísticos |

São **10/12 resultados esperados**, não uma taxa geral de qualidade. As duas divergências são importantes:

1. Em “Tem foto antes e depois, mas não mostrou o reparo sendo executado”, o modelo apontou o trecho positivo sobre antes/depois para uma regra de ausência durante. A validação recusou tratá-lo como ausência; o resultado foi orientação com decisão nula, em vez de Não Conforme.
2. Em “Só fotografaram antes de começar e no meio. Não registraram como ficou no fim”, o modelo escolheu uma orientação geral e marcou hipótese. Ficou sem decisão, embora o gabarito técnico espere Reprovado pela etapa final ausente. É uma reprovação esperada não recomendada, portanto impede homologação.

As mesmas duas perguntas já estavam registradas como dificuldades do perfil direto em [22/09](STATUS-DESKTOP-2026-09-22.md). A entrada direta corrige a arquitetura, mas não resolve sozinha a extração semântica do modelo. Não habilitei automaticamente o modo experimental, que anteriormente exigiu cerca de dois minutos nesses casos.

No recorte 72–77, os quatro casos com IA levaram de 24,6 a 35,0 segundos, média de 28,7 segundos. No recorte 66–71, as duas chamadas levaram 65,6 e 36,6 segundos. A máquina é de desenvolvimento, com outros processos ativos, não o Latitude corporativo. Não atribua diferenças de velocidade apenas à mudança do motor.

Relatórios preservados, fora do Git:

- `desktop-release/evaluations/2026-09-28T10-41-16-040Z.json` — recorte 72–77.
- `desktop-release/evaluations/2026-09-28T10-44-33-051Z.json` — recorte 66–71.
- Hash do avaliador nos dois recortes: `e7cb3a4f9a2add95b28f6befa91f28999684172c6c73d6a63da376feacc3d649`.

As rodadas estão completas e conferem decisão e grupos de fatos quando definidos no corpus. Não medem a qualidade de todas as respostas naturais. O relatório mais recente registra duas divergências e encerra com código 1 por esse motivo; não foi falha de inicialização do runtime.

## Como testar o código desta etapa

Use `npm.cmd run desktop:start`, seguindo [Executar e testar](EXECUTAR-E-TESTAR.md). Os builds foram atualizados, mas **não regenerei o instalador nesta etapa**: o Setup 2.18.0 existente continua sendo o artefato de 25/09, não contém esta evolução. Não o distribua como se fosse a compilação atual.

Não houve commit, push, deploy ou liberação para analistas nesta rodada. As alterações permanecem no workspace junto das mudanças anteriores, que foram preservadas.

## Próximo passo

Priorizar K09: melhorar a extração para distinguir, por trecho, a evidência e seu estado (presente, ausente ou não informado), com intenção explícita. O catálogo de evidências deve vir dos dados; nada de codificar etapas de um serviço dentro do motor genérico. O contrato atual ainda está associado às regras e não equivale à ficha independente proposta pela gestão.

Usar as duas divergências como regressões, acrescentar casos não usados nos ajustes e medir se a mudança melhora a interpretação sem aumentar decisões indevidas. Depois, executar os 100 casos completos com gabarito revisado pelo responsável, avaliar no Latitude e só então gerar uma versão de instalador candidata ao piloto de 5–10 analistas. Instalação em máquina limpa, distribuição confiável e aceite da TI continuam pendentes.
