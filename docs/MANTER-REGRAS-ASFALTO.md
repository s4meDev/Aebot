# Como mantenho as regras de Asfalto

## Onde edito

A fonte é [rulesStore.json](../src/data/rulesStore.json). Não edito engine.py para cadastrar regras. [catalogProfile.json](../python/catalogProfile.json) só seleciona os serviços do protótipo. No EXE, o catálogo é uma cópia recortada gerada pelo empacotador.

O histórico dos outros serviços permanece na fonte. O protótipo e o pacote consultam apenas as duas faixas de Asfalto e seus critérios compartilhados.

## Como leio um cadastro

| Campo | O que confiro |
| --- | --- |
| id | Identificador único e estável para citações e testes. |
| serviceId, applicableServiceIds | Serviço principal e outras faixas que compartilham exatamente a regra. Não duplico o texto para até/acima de 1 m². |
| category | Assunto para organizar a manutenção e a consulta na tela. |
| title, description | Nome curto e cenário realmente coberto. |
| severity | Uma das três conclusões oficiais, somente quando fornecida. Sem severity, a regra orienta ou pergunta. Retrabalho é ação, não conclusão. |
| evaluation.fact, scope, stance | Fato, escopo e tipo de ocorrência. Distingo OS atual, origem e adicional. |
| evaluation.requires | Contexto que precisa estar confirmado, como equipe ou frente. |
| evaluation.incompatible, exceptions | Situações que impedem aplicar a regra. Não retiro exceções para aumentar matching. |
| evaluation.ask | Contexto a perguntar quando ele muda a orientação. A pergunta fica em interpretation.contexts. |
| mandatoryConditions, mandatoryConditionGroups | Outras condições que conhecer equipe/frente não substitui. |
| semanticCriteria | Descrição natural do fato para a IA. Não é instrução para criar conclusão. |
| relatedEvidence, expressões e sinais | Objetos e relatos usuais. Não preciso cadastrar toda frase possível, mas isso não garante entender qualquer redação. |
| matchPolicy.minimumMatchedFactGroups | Combinação de fatos independentes já confirmados; nunca uma escolha livre do modelo. |
| message, guidance | Explicação curta e ação objetiva prevista. |
| examples, sourceReferences | Exemplos para testar e origem da orientação. Regra fornecida pelo responsável é válida sem documento formal. |

## Cuidados importantes

VCG não pontuar aferição da origem não dispensa a aferição do serviço atual. A falta de aferição depende da equipe. Em 03/11/2026, o responsável confirmou que trena impeditiva na OS atual também segue o vínculo: interna = Não Conforme com Retrabalho; terceirizada = Reprovado; sem equipe informada, perguntar. A base 2.20.0 incorpora essa confirmação, que prevalece sobre a divergência histórica.

Retificação substitui o contexto anterior no mesmo escopo. Etapa é informação por oração, não do caso inteiro. “Sem sinalização” não pode virar “sem foto”. Consulta e hipótese não comprovam ocorrência. Conforme exige conferência completa, não ausência de palavras negativas.

## Como faço uma alteração

O [mapa de arquitetura](../ARQUITETURA.md) separa os objetos. Altero `Session` para fluxo da conversa; `CaseFacts` para contextos/retificações; `Extractor` para interpretação; `Engine` para avaliação genérica. Uma regra de negócio fica no JSON, nunca em um método específico por ID. `AnalysisFlow` projeta as etapas e a base sem decidir nada.

Na 0.9.1, a consulta incompleta usa `PendingConsultation`, separada da OS e de `Scenario`. Recuperação de vários assuntos fica em `Extractor.consultation_groups`; exclusões linguísticas da consulta ficam em `Text.consultation_parts`. O resumo e as opções da tela pertencem a `case_overview.py`/`overview_ui.py`: não cadastro uma conclusão nesses arquivos. Para mudar interpretação, preservo o gabarito histórico e acrescento controles de consulta, hipótese, negação, escopo e retorno ao caso.

`FLUXO-ANALISE.json` preserva todos os campos e identifica o hash da fonte; `FLUXO-ANALISE.mmd` mostra os ramos por regra; `FLUXO-ANALISE.svg` e `FLUXO-ASFALTO.html` mostram o percurso geral e a volta de esclarecimento. Não edito esses arquivos gerados para mudar a análise. Consulto também a matriz `CONFERENCIA-DOCUMENTO-ASFALTO.md`, que registra as retificações posteriores ao TXT.

1. Localizo a regra pelo ID em Regras e fluxo ou no guia gerado.
2. Edito a fonte JSON, mantendo condições, exceções e conclusão claras.
3. Para regra nova, uso ID único, associo os serviços e descrevo o fato, não uma conversa inteira.
4. Atualizo a versão e acrescento testes, inclusive negação, exceção, contexto ausente e conflito.
5. Regenero guia e diagrama e executo os testes. Feedback só vira regra após revisão.
6. Gero uma versão nova do pacote, sem misturar entregas. Depois de testar o EXE, gero os pacotes assinados completo/diferencial e publico o catálogo por último, conforme [Distribuir na empresa](DISTRIBUIR-EMPRESA.md).

Na raiz do projeto:

    .\.venv\Scripts\python.exe python/export_rulebook.py
    $env:PYTHONPATH = 'python'
    .\.venv\Scripts\python.exe -m unittest discover -s python/tests -v
    .\.venv\Scripts\python.exe python/evaluate.py --output python/artifacts/minha-revisao.json
    .\.venv\Scripts\python.exe python/audit_asphalt.py --suite full --repeat 3 --output python/artifacts/minha-auditoria.json
    npm.cmd test
    npm.cmd run typecheck
    npm.cmd run build

O [diagrama](FLUXO-ASFALTO.html) abre sem internet. O [guia completo](REGRAS-ASFALTO.md) é uma fotografia da base, não outra fonte para editar regras.

Projeto de **Pedro Lucas Botelho Naus**.
