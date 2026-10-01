# Runtime restabelecido e validação da IA — 01/10/2026

## O que foi resolvido

Substituí o runtime sem assinatura pela distribuição Windows x64 CPU da Unsloth, versão `b11160-mix-a6922cc`. Conferi o SHA-256 do ZIP, as assinaturas Authenticode dos 52 executáveis/bibliotecas e a resposta do comando de versão. O Qwen carregou e respondeu com as proteções do Windows mantidas. A origem está no [release do fornecedor](https://github.com/unslothai/llama.cpp/releases/tag/b11160-mix-a6922cc) e os dados exatos no `desktop-resources/assets-lock.json`.

A nova pasta fica ao lado da antiga, sem apagar ou sobrescrever seus arquivos. O aplicativo e o empacotador usam somente a pasta selecionada. A extração usa o tar instalado no Windows, após validar o ZIP e seus nomes; isso elimina a dependência do módulo de extração PowerShell que estava indisponível. A preparação recusa arquivos alterados e bibliotecas extras, em vez de recalcular hashes para aceitá-los.

O próprio executável AEBOT e seu Setup ainda precisam do certificado do publicador. A assinatura Unsloth pertence ao runtime. Não foi gerado um novo instalador assinado nesta etapa; o Setup antigo não representa o código atual. O [guia de assinatura](ASSINATURA-E-LIBERACAO-WINDOWS.md) registra essa pendência e a necessidade de autorizar a verificação PowerShell segundo a política da TI.

## Falha encontrada e correção

A rodada iniciada em 29/09 às 21:48 UTC concluiu os casos 66–77: 11/12 resultados esperados, duas saídas inválidas, nenhuma aprovação indevida e nenhuma reprovação esperada perdida nesse recorte. Inicialização: 58,5 segundos. As seis chamadas ao modelo tiveram mediana de 34,9 segundos e máximo de 50,3 segundos.

Na divergência, o modelo reconheceu a ausência da execução, mas deixou a referência do trecho vazia. O parser recusou a saída e preservou orientação sem conclusão oficial. A recusa estava correta; o contrato de geração permitia esse JSON inconsistente.

Reforcei a gramática: `present`, `absent` e `uncertain` exigem ao menos uma referência; `not_mentioned` exige lista vazia. O parser continua verificando índices, citações e polaridade do relato. Não completei referências por adivinhação nem acrescentei frases do teste à base. O perfil local passou para `v6`, separando os caches da configuração anterior. Acrescentei um teste do contrato e mantive os testes que recusam ausências sem citação.

## Validação concluída do primeiro recorte

A repetição do recorte 66–77 com o contrato reforçado concluiu **12/12**, sem saída inválida, aprovação indevida ou reprovação esperada perdida. Está registrada em `desktop-release/evaluations/2026-10-01T15-42-03-714Z.json`, perfil `local:qwen3-4b-q4_k_m:v6:direct`. O caso que falhou passou usando o trecho correto. São seis chamadas à IA e seis resoluções determinísticas, não 12 interpretações realizadas pelo modelo.

Inicialização: 103,7 segundos. Chamadas à IA: mediana de 35,6 segundos e máximo de 48,1 segundos. Casos sem IA: mediana de 4 ms. A demora segue acima da meta sugerida de 20 segundos; variar o contrato não demonstrou ganho de velocidade. Havia aproximadamente 1,4 GB livres antes do carregamento e 0,8 GB depois, leituras pontuais que não medem pico nem provam a causa da latência.

| Verificação de código em 01/10 | Resultado |
| --- | --- |
| Vitest — rodada final após o perfil v12 | 540 aprovados, 1 ignorado; 38 arquivos aprovados |
| TypeScript | Frontend, ferramentas, Node, Worker e desktop aprovados |
| Builds | Desktop, extensão e servidor Node aprovados |
| Worker | Dry-run aprovado, sem publicação |
| Electron real | Smoke aprovado: isolamento, IPC, catálogo e análise determinística |
| Manifest V3 e bundle Node | Validações aprovadas, sem padrões de segredos incorporados |
| Arquivos offline | Preparação repetida e verificação de integridade aprovadas |
| Auditoria da base | 2.14.0, 36 serviços, 77 regras; estrutura aprovada |

A base permanece com oito serviços aguardando regras e seis nomes a confirmar. O aviso existente de `inlineDynamicImports` depreciado não impede os builds. O smoke não inicia o Qwen. A assinatura do instalador de ponta a ponta não foi validada, pois falta o certificado do AEBOT.

## Avaliação ampliada e segunda correção

Os 22 cenários restantes, no perfil `v6`, concluíram **18/22**, sem saída inválida. O relatório é `desktop-release/evaluations/2026-10-01T15-49-32-374Z.json`. As divergências foram: imóvel errado, chassi ilegível, falta de adicional executado e falta de adicional posterior. Todos ficaram sem conclusão; o primeiro deixou de recomendar uma reprovação esperada. Os outros casos incluíram saudação, hipótese, tentativa de induzir aprovação, novo caso e retificação. Decisão esperada não equivale a revisão completa da orientação.

A busca lexical limitava o catálogo local a seis candidatos e podia esconder uma classificatória antes da interpretação. Corrigi `LocalInterpretation.ts` para preservar todas as classificatórias atômicas do serviço, mantendo as orientações recuperadas e excluindo agregadoras. Também deixei explícita a revisão de cada trecho contra as demais regras, mesmo quando nenhum grupo de evidência foi mencionado. Duas regressões novas conferem o catálogo e a entrada determinística, inclusive serviços sem grupos de evidência.

No teste isolado do perfil `v7`, o Qwen passou a apontar a regra correta de local, mas marcou a irregularidade como negada: reconheceu execução e confundiu isso com ausência da falha. O motor preservou decisão nula. O relatório `2026-10-01T16-00-09-406Z.json` registra essa divergência. Reforcei a distinção genérica entre ocorrência da irregularidade e sua negação explícita; no perfil `v8`, o caso de imóvel errado passou, com uma chamada de 62,1 segundos.

Chassi ilegível ainda foi interpretado como negação da falha no perfil `v8`. Ampliei a validação linguística genérica para distinguir capacidade e incapacidade de conferir uma evidência, como conseguir ler ou identificar. Isso não determina uma conclusão: a classificação continua vindo da regra. Testes cobrem as duas polaridades e preservam hipóteses.

O perfil `v10` acertou os quatro rótulos dos casos 87–90, mas a inspeção revelou regras adicionais indevidas nos casos de parametrização. Esse resultado **não foi aceito como quatro interpretações corretas**. O avaliador e quatro casos do corpus passaram a conferir também `expectedClassifyingRuleIds`; uma classificatória extra ou ausente reprova o teste. Dois testes de ciclo de vida comprovam esse critério. Os relatórios anteriores continuam com seu critério original, sem alterações retroativas.

Acrescentei `LocalMappingVerification.ts`: interpretações locais com várias associações acionáveis passam por uma conferência focada somente nos fatos e IDs propostos. Essa chamada só confirma ou exclui; nunca adiciona regras ou altera a decisão. Campos extras, confirmações omitidas e falha técnica impedem usar a interpretação. Quando há exclusão, a narrativa anterior é retirada porque poderia repetir a associação rejeitada. A orientação é reconstruída pelo motor. Regras negadas não exigem confirmação porque não sustentam uma conclusão.

O perfil `v11` passou apenas um dos dois casos sob o critério estrito: o executado ainda carregou indevidamente a regra específica de repavimentação. A conferência do mesmo modelo, sozinha, não bastou. Os casos levaram aproximadamente 123 e 140 segundos, incluindo as duas chamadas.

No perfil `v12`, acrescentei uma prioridade baseada nos próprios dados: num fato simples, quando uma classificatória possui conceito explicitamente citado, associações concorrentes sem esse respaldo são retiradas. Usa normalização e expressões completas de `relatedEvidence`, sem IDs ou nomes de serviço no código. Frases coordenadas que podem conter vários fatos e paráfrases sem âncora literal continuam disponíveis para a conferência semântica. Testes protegem esses dois limites. A narrativa é reconstruída quando houve exclusão.

O recorte final do perfil `v12` passou **2/2** sob o critério estrito: os casos 89 e 90 sustentaram a conclusão somente em `RULE-PARAM-GERAL-01`, sem classificatórias extras. Relatório: `desktop-release/evaluations/2026-10-01T16-38-54-378Z.json`. Foram quatro chamadas reais, sem falha técnica; inicialização de 53,5 segundos e respostas de 121,8 e 129,8 segundos, incluindo a conferência adicional. Os builds, typechecks, smoke Electron, validações de bundles e integridade foram repetidos após essa alteração e passaram.

Isso não comprova que todos os fatos extraídos estavam corretos. No caso 89, o modelo marcou um relato como hipótese. Em ambos, o campo de compatibilidade `canonicalExpression` recebeu a primeira expressão da regra, referente à troca, embora os trechos fossem de executado/posterior: esse preenchimento vem do parser, não de uma escolha do Qwen, e não deve ser interpretado como fato extraído. A decisão não avalia esse texto canônico. O motor revalida o relato original, mas o teste atual de IDs não verifica todas essas distinções. A próxima validação precisa conferir também intenção, polaridade, evidência e orientação, sem aceitar somente o rótulo ou a regra final.

Essa conferência custa uma chamada adicional nos casos múltiplos; ainda não resolve a meta de velocidade. Ela também usa o modelo e precisa de homologação, sem ser anunciada como garantia de entendimento perfeito. A leitura pontual de memória livre após carregar foi de aproximadamente 58 MB nesta rodada; não mede pico nem prova a causa da demora, mas reforça a necessidade de ensaio controlado no notebook de destino. O corpus completo não foi repetido no perfil final.

Os relatórios contêm somente o corpus sintético e metadados técnicos. Não há persistência de conversas dos analistas. Acertar uma decisão nula não comprova que a orientação em português ou todos os estados de evidência estavam corretos. Esses pontos ainda precisam de revisão supervisionada.

## Próxima etapa

Validar o corpus completo e o gabarito com o responsável operacional; corrigir divergências com exemplos novos e conferir fatos, regras e orientação. Medir startup, resposta e memória no Latitude 3420 com os sistemas de trabalho abertos. A máquina usada aqui é Ryzen 5 5600G com cerca de 8 GB, e as medições não equivalem ao notebook corporativo.

Em paralelo, definir a assinatura do AEBOT e testar instalação sem internet em máquinas limpas. Somente depois dos aceites técnico e operacional liberar o piloto supervisionado de 5–10 analistas. K09/K10 continuam parciais: presença e dúvida ainda não chegam ao motor como um inventário independente completo.

README, arquitetura, guias de execução, assinatura e Kanban foram alinhados a essas mudanças, com os créditos de Pedro Lucas Botelho preservados. Nenhum arquivo funcional ou runtime anterior foi removido.
