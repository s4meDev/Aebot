# Protótipo de Repavimentação Asfalto — 07/10/2026

Registro da primeira etapa do dia, preservado como histórico. A revisão posterior está em [Otimização e assinatura — 2.19.0/base 2.15.1](STATUS-DESKTOP-2026-10-07-OTIMIZACAO.md). Os resultados e versões abaixo não representam a última compilação.

## Entrega implementada

Li integralmente `Repavimentação Asfalto atualizado.txt` e priorizei as duas faixas de Asfalto. Acrescentei 22 cadastros compartilhados em `rulesStore.json`, versão 2.15.0. A base passou a 99 regras/orientações e mantém 36 serviços.

Cadastrei etapas fotográficas, combinação antes + durante, qualidade das fotos, origem e sua aferição, medição, trena impeditiva, local/vala, material, acabamento, duplicidade, troca, formulário, desdobros e EHS. Conforme exige declaração de conferência completa sem irregularidades; ausência de regra não aprova.

As regras gerais de falta de adicionais e de aferição já existentes continuam reutilizadas. Sem aferição mantém a exceção anterior: interna = Não Conforme + Retrabalho; terceirizada = Reprovado. O TXT contradiz esse ponto, então pedi confirmação antes de substituí-lo. Não estendi automaticamente todas as novas regras a Bloco/Cerâmica, nem a Calçada simples.

Cancelamento é orientação operacional em duplicidade ou impossibilidade de troca, mantendo Reprovado como conclusão oficial. O código 318033 aparece na orientação de origem, sem inventar nome de serviço ou modificar uma OS pelo sistema.

## Engenharia e segurança

- `decisionPolicy` é validada no cadastro do serviço; Asfalto prioriza a conclusão mais grave entre regras aplicáveis. Os outros serviços mantêm o ranking anterior.
- `mandatoryConditionGroups` exige contexto no relato original, com alternativas dentro de cada grupo. A regra de equipe interna não pode ser usada se a equipe não foi informada, mesmo quando o modelo apontar seu ID.
- O contexto local das evidências passou a incluir títulos e descrições, não somente termos. Condições obrigatórias e exceções também são apresentadas ao modelo. O perfil foi alterado para v13; o motor continua revalidando serviço, relato, citações e contexto.
- A resposta curta “interna” após a pergunta de aferição já é resolvida pelo contexto e dados, sem uma chamada à IA nessa situação.
- O avaliador aceita `--corpus=asfalto`, registra 38 casos e conserva o serviço de cada um. Três paráfrases ficam reservadas ao modelo real; os testes lexicais não afirmam resolvê-las.
- O smoke verifica Asfalto por IPC e também seleciona o serviço na interface para a captura.
- `Abrir-AEBOT.cmd` abre o build pelo executável Electron já instalado no workspace. Não é EXE autônomo nem novo instalador. Não removi a assinatura obrigatória para fabricar um Setup distribuível sem certificado.

## Inferência real: falhas que não devem ser escondidas

No perfil v12, a primeira rodada das três paráfrases passou **1/3**. Relatório: `desktop-release/evaluations/2026-10-07T18-27-06-476Z.json`. O modelo acertou a duplicidade, mas não reconheceu a falta de imagem final e presumiu equipe interna no relato de trena. Foram perdidas duas reprovações esperadas; não houve aprovação indevida. Os casos levaram cerca de 120, 104 e 146 segundos. Esses resultados motivaram o bloqueio de contexto inventado e a melhoria do catálogo enviado à IA.

A repetição no perfil v13 concluiu **1/3**, registrada separadamente em `desktop-release/evaluations/2026-10-07T18-39-24-861Z.json`. Startup de 56,8 segundos; casos de 180,3, 162,0 e 172,2 segundos. O primeiro atingiu o timeout, a duplicidade passou e a trena terminou sem decisão. Foram perdidas duas reprovações esperadas, sem aprovação indevida. A regra de equipe interna não foi aplicada no caso da trena nesta rodada. Isso não comprova entendimento correto da trena nem qualidade geral da conversa.

Na revisão final, removi “foto/fotos” como tema isolado da regra de má qualidade: só mencionar uma imagem não deve sugerir que está tremida. Essa última alteração lexical foi coberta pela suíte automatizada, mas a inferência não foi repetida depois dela. Exemplos também foram incluídos nos novos cadastros, removendo os avisos de governança. Os relatórios registram somente o corpus sintético, hashes e metadados técnicos, não conversas dos analistas.

A máquina é Ryzen 5 5600G com aproximadamente 8 GB. Na primeira rodada havia cerca de 2 GB livres antes e 148 MB após carregar; essas leituras pontuais não medem pico nem provam a causa da latência. Não substituem medição no Latitude corporativo de 16 GB.

## Como testar hoje

O guia [Protótipo de Asfalto](PROTOTIPO-ASFALTO.md) explica a abertura neste computador, exemplos e limites. README, arquitetura e guia de edição foram atualizados, preservando os créditos de Pedro Lucas Botelho.

O Setup 2.18.0 antigo não foi atualizado e não representa estas alterações. Não encontrei certificado de assinatura com chave privada no repositório pessoal do Windows, nem configuração CSC disponível. Runtime assinado não assina o AEBOT. Novo EXE empresarial/Setup continua dependendo de certificado confiável e execução autorizada da verificação pela TI.

## Validação final do código

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test` | 627 aprovados; 1 ignorado, sem erro |
| `npm.cmd run typecheck` | Frontend, ferramentas, Node e Worker aprovados |
| `npm.cmd run desktop:smoke` | Typecheck desktop, compilação e Electron real aprovados; renderer isolado, IPC, seleção de Asfalto, combinação antes/durante e resposta da pergunta sugerida no chat conferidos |
| `npm.cmd run build:all` | Extensão, servidor Node e Worker em dry-run aprovados; não publiquei o Worker |
| `npm.cmd run rules:audit` | Base 2.15.0: 36 serviços e 99 cadastros; sem aviso de governança |
| `git diff --check` | Sem erro de whitespace; somente avisos de conversão LF/CRLF do Git no Windows |

A captura `desktop-release/desktop-preview.png` foi conferida com Asfalto selecionado e base 2.15.0. Corrigi a renderização da janela oculta do smoke para a captura não mostrar uma seleção anterior. O build mantém um aviso preexistente do Vite sobre `inlineDynamicImports`; ele não impediu a compilação. A versão do aplicativo continua 2.18.0: atualizar a base não significa que o instalador antigo tenha sido recompilado.

Os validadores de Manifest V3 e bundle Node passaram; este último não encontrou segredos incorporados. A conferência SHA-256 do GGUF, inventário do runtime e licenças também passou. Não acrescentei chaves, não removi arquivos, não publiquei serviços e não fiz commit nesta etapa.

Também abri o protótipo fora do smoke. Conferi a janela Electron deste workspace e o processo `llama-server.exe` do runtime fixado em execução. O aplicativo ficou aberto para avaliação manual. Isso confirma a abertura local, não o acerto das respostas nem a homologação do modelo.

## Próxima etapa

Confirmar a regra de aferição e quais regras se aplicam a Bloco/Cerâmica; revisar o gabarito com o responsável operacional. Corrigir as divergências e medir consumo/latência no Latitude antes do piloto. Depois, assinar aplicativo e Setup, testar instalação offline em máquina limpa e começar com 5–10 analistas supervisionados. Não está liberado para distribuição ampla.
