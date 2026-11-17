# Arquitetura do AEBOT

## Primeira instalação offline — entrega de 16/11/2026

O motor continua na 0.9.1. `offline_install.py` contém `OfflinePayload` (identidade fixa da entrega) e `OfflineSetup` (conferência e instalação). O instalador só aceita o pacote completo, assinado, com tamanho, hash e versão esperados. Reutilizo `updates.install_full`: preparo uma pasta separada, confiro todos os arquivos, executo o EXE com `--check` e só então disponibilizo o destino. Uma pasta existente nunca é sobrescrita e feedback não faz parte do pacote.

`offline_setup.py` é a tela: uma operação por vez em thread, eventos na fila e atualização de widgets somente no thread de Tk. Abrir e Abrir pasta ficam disponíveis após sucesso. Fechar durante instalação não interrompe uma ativação; falha permite nova tentativa sem declarar conclusão. O destino padrão é o perfil local, não Program Files, OneDrive ou pasta de rede. Não faço download, mudança de política, registro de inicialização automática ou instalação de serviço.

`package_offline.py` é do mantenedor: lê o pacote assinado já validado, incorpora sua identidade ao EXE do instalador e prepara pasta nova com manuais. `zip_delivery` confere o manifesto e fecha o ZIP somente depois do ensaio do EXE congelado. Não recompila o aplicativo/modelo nem troca a fonte de regras. `tests/test_offline_install.py` testa corrupção, identidade, assinatura, destino existente, validação e falha antes da publicação. `test_offline_setup.py` confere layout, operação única, espera e recuperação sem usar o perfil real. `--check --root --report` no instalador faz uma instalação real isolada, sem abrir o chat nem persistir conversa.

## Conversa e apresentação — Python 0.9.1

`Engine.validate_request` valida serviço e texto antes de qualquer mutação no `Session`. `PendingConsultation` pertence apenas à consulta incompleta; `Scenario` continua isolando a hipótese e `case_last` mantém a OS. Um esclarecimento explícito da consulta não vira fato. Continuação factual, troca de serviço e novo caso seguem caminhos próprios. Não há persistência de nenhum desses objetos.

`Text.consultation_parts` separa os assuntos pedidos, preservando negações e exclusões explícitas. `Extractor.consultation_groups` recupera os assuntos, confere contexto por trecho e retoma somente objeto/assunto já declarado; comparar aferição entre escopos não declara falta da própria OS de origem. Âncoras genéricas não dispensam o modelo. O `Engine._consult` constrói alternativas do JSON e pede o ponto que ainda não foi entendido. Isso não altera a avaliação classificatória nem permite ao BGE inventar regras.

`case_overview.py` contém `CaseOverview`, `ContextAnswer` e a projeção pura `build_overview`. O objeto recebe a avaliação vigente, não extrai negócio do chat renderizado. Não usa consultas como fatos nem apresenta contexto antigo quando há incerteza. `overview_ui.py` apresenta resumo e pergunta; o app decide quando mostrar a coluna conforme o tamanho da janela. Opções vêm do contexto pendente cadastrado, exigem escolha e são enviadas como declaração explícita. Dúvida/hipótese não enviada no rascunho não entra no caso ao clicar numa opção.

`App` serializa o envio, permite preparar um rascunho enquanto o trabalhador roda e limpa o resultado visual no início do turno. Falha recupera o texto enviado somente se o usuário não tiver preparado outro. A ação de cópia usa o resultado tipado e inclui referências; não é exportação automática. O resumo não decide, não altera o catálogo e não grava nada.

`benchmark_reranker.py` compara perfis de CPU com pares sintéticos em série; não integra telemetria. `consultation_multi_cases.py` acrescenta gabarito independente à auditoria sem modificar o anterior. `test_semantic.py --output` começa um relatório antes de carregar o modelo e preserva resultados anteriores quando o destino é explícito. Guias e fluxogramas continuam gerados da fonte única.

`compare_audits.py` é a barreira de regressão do mantenedor: compara identidade, gabarito e resultado de todos os casos históricos, registra os novos e preserva divergências anteriores. Não considera erro técnico um acerto. `LocalReranker` valida quantidade e finitude de scores antes de devolvê-los: saída vazia ou extra não pode ser preenchida silenciosamente com zero.

## Central corporativa e fluxo — Python 0.8.1

`publish_channel.py` é ferramenta do mantenedor: prepara pacotes imutáveis, confere a versão antes de trocar o instalador público e publica o catálogo por último. `bundle_company.py` confere assinaturas, identidades e hashes e monta o ZIP da central nova usando somente uma lista permitida de arquivos públicos. Não é executado pelo analista. `test_distribution_exe.py` testa instalação completa, diferencial, processo congelado e rollback numa pasta de laboratório, sem acesso corporativo.

`company_source.py` localiza somente a biblioteca autorizada por pontos de montagem/atalhos OneDrive ou escolha explícita. Não lê credenciais. `UpdateChannel` e `ChannelRelease`, em `update_channel.py`, validam o catálogo assinado e selecionam um pacote pela versão e pelo hash da base instalada. O leitor da origem permite placeholders CLOUD conhecidos do OneDrive; destino executável continua rejeitando reparse points. Não há HTTP/Graph nem autenticação no AEBOT.

`ChannelClient` executa a leitura/cópia em um filho do próprio atualizador, com prazo e cancelamento. A consulta usa 20 s; a obtenção usa até 15 min. Somente esse filho pode ser encerrado; não mato OneDrive, navegador ou processos do usuário. `ChannelWindow` apresenta versões e confirmação. `updater_main.py --channel-job` não abre janela nem carrega ONNX. Pacote manual e rollback permanecem na tela. A antiga `update_ui.py` foi substituída; não há import da tela para o ponto de entrada.

`install_full` prepara uma primeira instalação em pasta nova do perfil; `apply_update` usa a versão instalada como origem. Ambos verificam todos os arquivos e executam diagnóstico antes de ativar. O botão do app chama o lançador da versão ativa, não fica preso à tela do lançador original 0.7.0. `publish_channel.py` grava pacotes por hash, preserva histórico e atualiza o catálogo por último. Não modifica AutoForms ou permissões corporativas.

Para análise, `RuleStore`, `Session`, `CaseFacts`, `Extractor` e `Engine` continuam com suas responsabilidades. `AnalysisStage` e `AnalysisFlow` descrevem etapas e projetam todas as regras/condições/exceções para manutenção. `export_rulebook.py` gera HTML, SVG, Mermaid e JSON. O desenho não é executado para decidir a OS; não pode virar outro cadastro de negócio. A matriz do TXT está em [Conferência do documento](docs/CONFERENCIA-DOCUMENTO-ASFALTO.md).

## Atualizações por versão — Python 0.7.0 / base 2.20.0

`updater_main.py` gera o lançador estável `Abrir-AEBOT.exe`, independente da IA. `aebot/updates.py` valida a assinatura Ed25519 com `update_trust.py`, caminhos, inventário, hashes, origem/destino e limites de tamanho. `create_update.py` compara duas entregas completas e inclui só arquivos alterados no `.aebot-update`. A chave privada do mantenedor não entra em código, manifesto ou pacote.

No notebook, `update_ui.py` recebe o arquivo escolhido. O destino fica em `.aebot-updates/releases/<versão>-<hash>` da pasta original. Arquivos iguais vêm da versão instalada, por cópia; isso não é download nem link para dados do usuário. Depois de conferir a pasta completa e executar `AEBOT.exe --check`, o atualizador troca `current.json` atomicamente. A versão anterior não é sobrescrita. `current_directory` verifica a versão assinada antes de abri-la; o rollback é explícito. `update.lock` usa trava do sistema liberada no fechamento, sem apagar arquivos do usuário.

O botão da interface fecha o chat com confirmação e abre o lançador em `--update`. O runtime/feedback seguem nos caminhos anteriores; não introduzi rede, telemetria ou migração de conversas. A versão 0.6.3 usa um atualizador de transição uma vez, pois não continha esse botão. Leia [Atualizar AEBOT](docs/ATUALIZAR-AEBOT.md) e [manutenção e resultados](docs/ATUALIZACOES-PYTHON-070.md).

## Preparação de uso — Python 0.6.3 / base 2.20.0

`CaseFacts.context_sources` guarda apenas em memória o trecho/turno que confirmou o contexto. Valores contraditórios no mesmo turno e escopo não escolhem o último. Uma incerteza explícita sobre o dado anterior suspende sua confirmação; respostas posteriores e retificações continuam permitidas. `Text.flexible(..., context=True)` não reduz uma expressão de disponibilidade a um verbo isolado. `Extractor` distingue resposta incerta só de contexto de outra ocorrência incerta. As decisões seguem exclusivamente na fonte JSON.

Os controles novos ficam em `python/tests/test_release_readiness.py` e `python/audits/release_cases.py`, somados à auditoria completa sem mudar gabaritos antigos. O pacote leva `COMO-USAR.md`, copiado de `docs/USAR-ASFALTO.md`. Veja [a revisão 0.6.3](docs/REVISAO-PYTHON-063-2026-11-12.md).

## Segurança linguística — Python 0.6.2 / base 2.20.0

`Text` recebe os termos de registro da fonte validada e preserva sua palavra literal ao retomar uma etapa. A leitura distingue negação de falta de reforço por “não só”. `CaseFacts` registra alternativas como `ContextFact.value: null`; `context()` as trata como dado pendente e não recupera o valor antigo desse escopo. Isso não muda o schema da fonte nem cria uma decisão oficial.

Se só há observações inativas e nenhum ponto pendente, o motor reconhece que aquele relato não confirmou falha, mantendo `decision: null`. A tela de fundamentos mostra esses trechos separados dos matches aplicáveis. A combinação de faltas continua recebendo apenas observações ativas. Veja [a revisão 0.6.2](docs/REVISAO-PYTHON-062-2026-11-04.md).

## Roteamento da conversa — Python 0.6.1 / base 2.20.0

`Session.ask` separa consultas gerais antes de montar o relato acumulado. A consulta usa só a pergunta atual; o estado factual e a pendência não são regravados por ela. `Scenario.last` pertence à própria hipótese, independente da resposta mais recente do chat. `Session.pending` permite à interface avisar que ainda há um contexto pendente depois de uma consulta. Contexto informado pode vir com outras falhas; não há atalho por contagem de palavras.

Novo caso e mudança de serviço limpam caso, hipótese e caches. No mesmo caso, uma consulta não limpa o cache de pares para forçar inferência repetida do relato anterior. A interface descarta o fundamento anterior ao iniciar nova análise e não o reapresenta se o turno falhar. `benchmark_conversation.py` mede consultas sintéticas antes/depois, sem integrar coleta ao aplicativo. Veja [a revisão 0.6.1](docs/REVISAO-PYTHON-061-2026-11-03.md).

## Interface e apresentação — Python 0.6.0 / base 2.20.0

O motor produz `Evaluation`; `response.py` organiza o texto sem alterar a decisão. O chat recebe a forma compacta, enquanto `evidence_ui.py` mostra a resposta completa, regras, trechos e distinção entre fato, consulta e hipótese. Tudo fica em memória, separado do formulário de feedback. `app.py` centraliza o estado de espera, recuperação de carregamento e limpeza visual. A base da interface e do motor precisa ser idêntica.

`text.py` mantém caches limitados por instância; `session.py` os limpa junto dos caches semânticos ao iniciar outro caso. Na consulta, o pedido de explicação é retirado somente para comparar o assunto literal no BGE; a citação original permanece no resultado. Veja [a revisão 0.6.0](docs/REVISAO-PYTHON-060-2026-11-03.md).

## Retificação de trena — Python 0.5.1 / base 2.20.0

Em 03/11/2026, o responsável confirmou o tratamento de Não Conforme + Retrabalho para equipe interna quando a trena impede a conferência. A fonte única mantém `RULE-ASF-TRENA-01` para essa condição e acrescenta duas alternativas de dados: equipe terceirizada e contexto de equipe ainda ausente. Todas compartilham o fato `measurement-obstructed`, com contexto tipado. Não alterei o motor genérico para conhecer o serviço ou esses IDs.

São 39 regras/orientações no perfil, 102 na fonte histórica. Os gabaritos de trena sem vínculo foram atualizados por mudança explícita de critério, com matriz nova para ambas as faixas. Veja a [retificação e validação](docs/ATUALIZACAO-TRENA-2026-11-03.md). As seções abaixo são histórico. Créditos: **Pedro Lucas Botelho Naus**.

## Atualização Python 0.5.0 — 03/11/2026

Mantive a rota offline e a fonte única. A interface 0.4.0 permanece; mudei a interpretação e o estado de esclarecimento.

- `contracts.py`: `Source.message_index` identifica a mensagem original; `pendingClarification` liga uma pergunta ao trecho e ao escopo; `Match.application` distingue fato, consulta e cenário hipotético.
- `text.py`: separa predicados de uma frase e só retoma uma evidência em complemento declarado. “Nem sinalização” não recebe “foto” da oração anterior.
- `session.py`: guarda em memória as substituições explícitas de trechos ambíguos. `Scenario` isola o estado da hipótese. Novo caso limpa substituições e caches. Uma falha nova, sem retificação explícita, não apaga a dúvida pendente.
- `engine.py`: filtra fontes substituídas antes de aplicar fatos, condições, exceções ou aprovação. A consulta não transforma equipe/frente em assunto de uma regra por si só.
- `extraction.py`: cache de comparações e interpretações compartilhando limite de 256 entradas por extrator, só no caso atual. Não persiste textos nem reduz o catálogo classificatório.
- `audit_asphalt.py` e `audits/readiness_cases.py`: casos sintéticos novos, cobertura individual das regras e separação entre citação, hipótese e fato. Relatórios não são telemetria do aplicativo.

As seções abaixo são histórico. Veja a [prontidão atual](docs/PRONTIDAO-ASFALTO-2026-11-03.md) e o [guia de execução](docs/EXECUTAR-PYTHON.md). BGE continua sendo um relacionador semântico, não um modelo generativo. Créditos: **Pedro Lucas Botelho Naus**.

## Atualização Python 0.4.0 — 22/10/2026

Refiz a interface em branco e azul. As seções anteriores do Python e o legado abaixo ficam como histórico; a ordem atual é janela → sessão em memória → fatos/contextos → BGE quando necessário → condições/exceções → avaliação → orientação.

| Arquivo | Responsabilidade na versão atual |
| --- | --- |
| python/main.py | Entrada e diagnóstico explícito, sem salvar conversa. |
| python/catalogProfile.json | Seleciona as duas faixas de Asfalto e declara o papel do assistente. Não contém decisões. |
| schemas/catalogProfile.schema.json | Valida a estrutura do perfil e rejeita campos desconhecidos. |
| src/data/rulesStore.json | Fonte única de regras, condições, exceções e orientações. Base 2.19.0. |
| python/aebot/store.py | Valida a fonte e gera o recorte usado pelo protótipo e pacote. |
| python/aebot/app.py | Janela, chat e ações. Só o chat expande; o envio fica reservado. A análise devolve eventos pela fila, sem desenhar widgets na thread de trabalho. |
| python/aebot/theme.py | Cores e estilos comuns às janelas. |
| python/assets/ | Logo Aegea fornecida, embarcada sem download. |
| python/aebot/rulebook.py | Busca e consulta às regras reais, com condições, exceções e diagrama. Não edita a base. |
| python/aebot/session.py | Continuação, esclarecimento, retificação e Novo caso só em memória. Consultas e hipóteses não acrescentam falhas à OS real; a simulação mantém estado próprio apenas enquanto pede esclarecimento. |
| python/aebot/text.py, facts.py, extraction.py | Normalização e fatos por oração, etapa, escopo e contexto. |
| python/aebot/reranker.py | BGE local: mede relevância, não ocorrência nem percentual de acerto. |
| python/aebot/engine.py, contracts.py | Revalidação, combinação de fatos, conflitos, consulta condicional e resultado tipado. Sem regras ou IDs de Asfalto no motor. |
| python/aebot/feedback.py, feedback_ui.py | Formulário voluntário e SQLite local, com leitura e importação/exportação explícitas. |
| python/export_rulebook.py | Gera o guia e diagrama da base real; não é outra fonte de negócio. |
| python/package_app.py, zip_app.py | Estágio versionado, EXE, recursos, catálogo recortado, licenças e manifesto. Preservam entregas anteriores. |
| python/tests/, test_app.py, audit_asphalt.py | Regressões, janela real e auditoria sintética com modelo. Não coletam conversas de analistas. |

No código-fonte, preservei o catálogo histórico. No pacote, resources/src/data/rulesStore.json contém somente os dois serviços e suas 37 regras/orientações aplicáveis. É uma projeção gerada, não outro cadastro manual. As condições e conclusões permanecem iguais às da fonte.

O papel de Programador de Serviços Sênior descreve o apoio desejado. BGE não virou um modelo gerador: consultas explicam caminhos e exceções; casos concretos continuam exigindo informações reais.

Guias atuais: [manutenção](docs/MANTER-REGRAS-ASFALTO.md), [execução](docs/EXECUTAR-PYTHON.md) e [revisão](docs/REVISAO-ASFALTO-2026-10-22.md).

Projeto de **Pedro Lucas Botelho Naus**.

## Rota Python — revisão de 20/10/2026

Esta é a implementação nova em avaliação. As seções seguintes são o histórico do Electron/TypeScript e não devem ser confundidas com o fluxo Python. Mantive o legado para evitar apagar recursos que ainda não migrei.

Fluxo: janela Tkinter → sessão em memória → normalização e separação de fatos → regras do serviço → interpretação ONNX quando necessária → condições/exceções e combinação de fatos → decisão e orientação. Não existe servidor HTTP, processo llama-server nem geração de parágrafos pelo modelo nesta rota.

Arquivos, na ordem da arquitetura:

| Arquivo/pasta | Responsabilidade |
| --- | --- |
| `python/main.py` | Abre a janela; `--check` testa o runtime e uma paráfrase real do modelo. |
| `python/aebot/app.py` | Interface, seleção dos dois serviços, fila entre threads, conversa e Novo caso. Não decide regras. |
| `python/aebot/feedback_ui.py` | Formulário vazio, consulta, busca, exportação e importação explícitas de feedback. Não acessa o chat. |
| `python/aebot/feedback.py` | SQLite local criado somente após envio/importação; valida formato, limita tamanho e evita duplicidade/conflito de IDs. Não armazena métricas nem conversas. |
| `python/aebot/session.py` | Contexto temporário; une continuações explícitas e respostas a uma informação pendente. Trocar caso ou serviço limpa o contexto. |
| `python/aebot/contracts.py` | Fontes literais, observações, contexto e avaliação; `pendingContext` guarda o dado/escopo pendente. Hipótese tem `scenarioDecision`, não decisão de uma OS real. |
| `python/aebot/text.py` | Normaliza caixa, acentos, aliases e tokens; identifica intenção, negação e voz passiva. Preserva citação e antecedente de “nem”. |
| `python/aebot/store.py` | Lê e valida o JSON compartilhado; filtra serviço e confere condições/exceções no relato original. |
| `python/aebot/facts.py` | Índice de fatos e estado do caso: origem/atual/adicional, equipe, frente e observações ativas. O valor mais recente substitui o anterior no mesmo fato/escopo. |
| `python/aebot/extraction.py` | Recuperação lexical, consulta por assunto e interpretação BGE dos trechos não resolvidos. Negações e incerteza não comprovam falha. Cache em memória limitado ao caso. |
| `python/aebot/engine.py` | Coordena extração, aplica contextos/condições/exceções, agrega fatos confirmados e resolve a conclusão. Formata a resposta curta. Não contém nomes/IDs de regras de Asfalto. |
| `python/aebot/reranker.py` | Compara pares de texto com BGE local. Retorna relevância, não porcentagem de acerto. Um par por inferência evita interferência da quantização entre exemplos do lote. |
| `python/aebot/runtime.py` | Encontra os recursos do código/EXE, confere tamanho e hashes do modelo e carrega o motor uma vez. Não baixa nada. |
| `src/data/rulesStore.json` | Fonte única de regras, conclusões, condições, exceções, mensagens e orientações. `semanticCriteria` opcional descreve o significado da regra sem mudar sua conclusão. |
| `interpretation` / `evaluation` no JSON | Catálogo de escopos/contextos e objetos de registro (`recordTerms`); cada regra indica fato, ocorrência, contexto exigido e incompatível. `perStatement` limita a etapa à oração, sem contaminar outra evidência. Campos opcionais validados também no legado. |
| `src/data/languageAliases.json` | Equivalências linguísticas compartilhadas com o legado. |
| `schemas/rulesStore.schema.json` | Validação de estrutura e apoio à edição no VS Code. |
| `python/prepare_model.py` + `reranker.lock.json` | Preparação online pelo mantenedor, revisão fixa do modelo e verificação de bytes. Não recebe relatos de OS. |
| `python/tests/` | Testes rápidos de regra, contexto, contratos e integridade, sem rede neural. |
| `python/evaluate.py` | Compara decisões e regras com os 53 casos antigos, usando a sessão real. |
| `python/test_semantic.py` | Cenários sintéticos adicionais com modelo real; não é um conjunto cego de homologação. |
| `python/test_app.py` | Testa janela, fila, Novo caso, equipe e serviço com IA real, formulário sem anexar conversa e leitura do feedback temporário. |
| `python/audit_asphalt.py` + `python/audits/` | Auditoria sintética de combinações, linguagem livre, negação, contexto e relatos longos. Não altera o motor; mede decisão, fundamento, comportamento e latência. Resultados e limites em `docs/AUDITORIA-ASFALTO-2026-10-20.md`. |
| `python/package_app.py` | Monta EXE portátil, recursos permitidos, licenças, versões e hashes. Não copia o workspace inteiro. |
| `python/zip_app.py` | Confere o manifesto e a ausência de arquivos extras antes de criar e verificar o ZIP de transferência. |
| `python/requirements*.txt`, `environment-tested.txt` | Dependências diretas, ferramenta de build e fotografia do ambiente completo testado. |
| `python/LEIA-ME.txt`, `THIRD-PARTY-NOTICES.md` | Guia do analista e identificação dos componentes distribuídos. |
| `python/models/`, `build/`, `dist/`, `artifacts/`, `.venv/` | Pesos, intermediários, entrega, medições e ambiente gerados localmente; ficam fora do Git. |

Limites importantes: a relevância semântica ainda é heurística, não prova formal de ocorrência. Limiar e margem são controles técnicos, não garantia estatística. A versão é focada em Asfalto; não homologuei a equivalência do motor Python com todos os serviços nem migrei todas as funções administrativas. A resposta atual usa as mensagens da base, não um LLM redator livre. Veja [as pendências e medições](docs/STATUS-PYTHON-2026-10-19.md).

Na 0.3.0, o modelo compara os grupos elegíveis do serviço, com contexto literal quando uma oração retoma a anterior. `contextQuotes` permite conferir essa relação; escopos diferentes não compartilham a comparação. Há uma segunda organização dos mesmos textos apenas quando a primeira comparação é ambígua, sem baixar o limiar. Cache limitado em RAM considera texto original, contexto, serviço, versão e candidatos; Novo caso limpa esse cache. Não uso lista de palavras de defeito como requisito para consultar o modelo. Isso melhora cobertura, mas não transforma o BGE em prova de ocorrência nem elimina abstenções.

A retomada de substantivo em “só falta antes” exige que o complemento pertença ao contexto por oração declarado na base. `store.py` entrega essas expressões ao normalizador; não trato “sem sinalização” como elipse de uma foto citada antes. Além da regressão específica, os testes de unidade conferem as 1.024 combinações explícitas sem depender da rede neural.

O feedback fica fora do fluxo de análise: interface → formulário voluntário → validação → SQLite. Exportar/importar usa JSON local e transação; campos desconhecidos e colisões de conteúdo são rejeitados. O arquivo não é sincronizado nem usado como treinamento automático. [Guia de feedback](docs/FEEDBACK-PYTHON.md) e [revisão 0.3.0](docs/REVISAO-INFORMAIS-FEEDBACK-2026-10-20.md).

O pacote leva `00-COMECE-AQUI.txt`, modelo, regras e runtime. O diagnóstico `--check` verifica Tk, duas análises e o feedback sintético em banco temporário, sem acessar o banco do usuário. `copy_guides` e `write_manifest` no empacotador permitem finalizar a documentação depois de testar o EXE e antes de conferir o ZIP. Isso não assina o aplicativo nem garante liberação por políticas do Windows.

## Revisão do núcleo em 13/10/2026 — código 2.23.0

Separei o fluxo de análise do transporte do Gemini. O desktop continua offline; trocar o cliente não troca o motor nem as regras. Não migrei para Python: a inferência pesada já roda em C++ no llama.cpp, e a troca da linguagem da aplicação, sozinha, não resolve a demora medida.

- `src/ai/AnalysisProvider.ts`: coordena contexto, cobertura do relato, interpretação, conferência, cache em memória e resposta. Não contém decisões específicas de serviço.
- `src/ai/GeminiModelClient.ts`: transporte HTTP e configuração do perfil Chrome legado. O desktop injeta `LocalModelClient` e não usa essa configuração.
- `src/ai/GeminiProvider.ts`: mantém os imports antigos compatíveis; reexporta os módulos acima, sem duplicar a lógica.
- `src/ai/ModelContents.ts`: monta o histórico recente e a pergunta atual sem duplicação.
- `src/services/AnalysisCoverage.ts`: confere se o matching lexical cobriu o relato completo. Contexto obrigatório já reconhecido não pede IA outra vez. Uma parte desconhecida impede fechar uma análise parcial como se fosse completa.
- `src/services/FactSources.ts`: separa orações negativas preservando a citação original, inclusive “nem” e “e não”. `LocalSources.ts` reaproveita essa função.
- `src/services/__tests__/AnalysisCoverage.test.ts`: protege fatos mistos, falha segura da interpretação, preservação de fatos comprovados, serviço inválido e atalhos determinísticos.

Interpretação e conferência usam o mesmo prefixo público de sistema; o modo da chamada fica no pedido. Cada citação/estado continua conferido. Prepare novamente o catálogo público após mudar essa instrução. Não grave slots de conversas.

O corpus de Asfalto tem **53 casos sintéticos**. Modelos menores e um classificador NLI foram comparados, mas não adotados por apresentarem divergências. O [relatório da revisão](docs/STATUS-DESKTOP-2026-10-13.md) separa correção de código, qualidade do modelo e latência. Esta revisão não é um anúncio de aplicativo pronto ou de novo EXE publicado.

## Rota atual: desktop offline

Atualização de 07/10: `Abrir-AEBOT.cmd` abre o build local pelo executável Electron existente no workspace. É um atalho de desenvolvimento; o instalador empresarial continua exigindo assinatura. O protótipo de Asfalto é descrito em `docs/PROTOTIPO-ASFALTO.md`.

O novo ponto de entrada é `desktop/main.ts`, um processo Electron que inicia o runtime e mantém o motor fora da interface. A interface React existente acessa somente operações tipadas em `src/desktop/contracts.ts` através de `desktop/preload.ts`. Não há servidor central ou autenticação por API no desktop.

Ordem de execução: interface → IPC validado → `AnalysisService` → avaliação lexical e cobertura → `LocalModelClient` quando necessário → Qwen/llama.cpp no loopback → JSON validado pelo `SemanticInterpreter` → `RuleEngine.evaluateFacts` → explicação curta. Casos conclusivos com relato totalmente coberto usam diretamente o motor. Uma primeira regra reconhecida não encerra a análise de outro fato ainda desconhecido. Perguntas pendentes e retificações continuam usando os contratos existentes.

Desde 28/09, o orquestrador entrega `SemanticEvaluationInput` a `RuleEngine.evaluateFacts`: relato original, serviço selecionado e mapeamentos com citações. O motor revalida essa entrada e `RuleRetriever.retrieveMappedRules` avalia somente as regras apontadas e suas combinações previstas na base, sem reconstruir texto para pesquisar todo o catálogo novamente. Exceções e condições obrigatórias são conferidas no relato original, inclusive nas regras agregadoras. O resultado, o ranking e a formatação continuam compartilhados com `evaluatePrompt`.

Na revisão 2.21.0, o cliente local usa o contrato curto `indexed`: trechos numerados, IDs legíveis de regras e intenção codificada, com orientação/pergunta opcionais. O catálogo completo de regras atômicas fica no prefixo de sistema, antes do histórico e do relato, permitindo reaproveitar sua leitura em RAM. A identidade real do serviço permanece no pedido e na validação do motor. Agregadoras não ficam à escolha do modelo. Os protocolos `compact` anterior e por estados de evidência permanecem para referência/testes. A validação reconstitui citações literais e o motor revalida condições e exceções no original. `canonicalPrompt` não decide a análise. Ainda não há ficha independente completa; K09/K10 registram esse avanço parcial no [Kanban](docs/KANBAN.md). Medições e limitações em [desempenho local](docs/DESEMPENHO-IA-LOCAL.md).

Arquivos do desktop, na ordem de responsabilidade:

Atualização 2.22.1: `src/ai/LocalSources.ts` separa itens negados mantendo citações literais e o “nem”. Isso não altera o matching lexical nem cria fatos. A conferência local recebe também título e descrição da regra indicada, além do catálogo completo. `scripts/download-packet.mjs` confere o pacote, gera ZIP64 e partes de 1 GiB, com montagem verificável por SHA-256. Não publica automaticamente, não inclui perfil do analista e não altera proteções. Os testes ficam em `LocalSources.test.ts` e `download-packet.test.mjs`.

Para enviar a entrega já gerada, `scripts/prepare-transfer.mjs` valida a pasta de origem e o manifesto da versão atual, confere cada parte e o hash do ZIP combinado e verifica novamente as cópias. Cria uma pasta `PARA-ENVIAR-AEBOT-*` e um ZIP pequeno com guia, montador e hashes. Não recompila o aplicativo, não executa a IA, não copia o workspace/perfil nem publica sozinho. Os contratos e a conferência de bytes são testados em `scripts/__tests__/prepare-transfer.test.mjs`; o uso está em `docs/TRANSFERIR-AEBOT.md`.

As apresentações ficam em `apresentacoes/`, com versões anteriores preservadas e a versão curta em `AEBOT-2026-10-08/resumo`. `.gitattributes` mantém PDF e PPTX como binários, sem conversão de quebras de linha pelo Git.

- `desktop/main.ts`: janela, validação do remetente IPC, coordenação das análises e diálogos de importação/exportação.
- `desktop/preload.ts`: ponte limitada entre interface isolada e processo principal; não expõe Node nem IPC genérico.
- `src/desktop/contracts.ts`: operações e estado do aplicativo local.
- `desktop/ModelRuntime.ts`: processo llama.cpp oculto, porta aleatória em 127.0.0.1 e credencial temporária. `resourceProfile` ajusta o contexto à RAM física e fixa cache de atenção q8, flash attention e reserva de cache de slots igual a zero. Distingue processo encerrado, autenticação recusada, runtime sem resposta e modelo ainda carregando. Se o pedido de encerramento falhar, preserva a referência e não inicia outro processo. Sinal enviado não equivale a confirmação de saída do Windows.
- `desktop/ModelIntegrity.ts`: confere tamanho e SHA-256 do modelo antes de iniciar a inferência.
- `desktop/LocalModelClient.ts`: requisição local com JSON restrito, timeout e validação; não tem contingência externa.
- `src/ai/LocalInterpretation.ts`: constrói prefixo fixo e pedido variável. No perfil padrão, preserva todas as regras atômicas e orientações do serviço. Confere campos curtos, IDs legíveis, intenção e índices dos trechos; reconstrói citações e delega à validação semântica. Posições numéricas para regras foram descartadas após confusão de etapas na inferência real. Não decide a OS.
- `src/ai/EvidenceInterpretation.ts`: deriva o catálogo dos dados e apresenta título, descrição e conceitos de cada evidência. Solicita estados e trechos ao modelo, recusa campos/grupos desconhecidos e converte ausências válidas para o contrato semântico compartilhado. Outras regras levam condições obrigatórias e exceções. A gramática exige referência para estados relatados e lista vazia para `not_mentioned`; o parser revalida o significado. Não contém etapas ou IDs de um serviço fixados no código.
- `src/ai/LocalMappingVerification.ts`: prioriza conceitos explícitos dos dados quando classificatórias concorrem sobre um fato simples; preserva coordenações e paráfrases sem âncora literal. Se ainda houver várias associações acionáveis, a segunda chamada local confirma ou exclui IDs já indicados, sem criar fatos ou conclusões. Exclusões retiram a narrativa que poderia depender delas. Falha da conferência impede usar a interpretação e preserva a contingência do motor. Acrescenta latência e não substitui revisão operacional.
- `desktop/RuleRelease.ts`: pacote de regras com responsável, vigência, versão e histórico descritivo; reutiliza o schema oficial.
- `desktop/LocalData.ts`: escrita atômica, métricas sem conversas e feedback voluntário local.
- `desktop/PublicCatalogCache.ts`: restaura apenas a leitura preparada do catálogo. Confere índice fixado no bundle, arquivo, modelo, runtime, instrução e perfil; nunca salva slots de análise. Sem recurso compatível, a inferência processa a base atual normalmente.
- O contrato curto preserva a oração em “não há X nem Y” e aceita dois fatos citando o mesmo trecho. Também preserva frases distintas da mesma regra. A conferência por citação valida situação e estado com campos nomeados; confirmar uma frase não confirma automaticamente as outras. Dupla negação é normalizada antes de aceitar ausência.
- `desktop/prepareCatalog.ts` e `scripts/prepare-public-catalog.mjs`: preparação isolada pelo mantenedor, recebendo só IDs do catálogo. Usa template/tokenização oficiais, gramática vazia e dois perfis de memória; publica o índice somente depois de concluir. Preserva arquivos anteriores e não recebe conversas.
- `desktop/PublicCatalogPreparation.ts`: valida os contadores da preparação. O runtime pode contar um encerramento mesmo com `n_predict=0`, mas nenhum texto é aceito; o arquivo precisa ter exatamente os tokens da entrada pública. Os testes correspondentes cobrem geração indevida, truncamento e estado incompleto ou com token extra.
- `desktop/SmokeSemanticCheck.ts`: confere conclusão, regras e contadores públicos do teste com IA real. Não exige tentativas privadas no renderer nem amplia o IPC. `desktop/__tests__/SmokeSemanticCheck.test.ts` recusa falso acerto, ausência de inferência e erro técnico. `--aebot-smoke-semantic` testa desenvolvimento; só o EXE final com `--aebot-package-check` testa a distribuição.
- `scripts/public-catalog-definition.mjs`: incorpora o hash do índice no build desktop/avaliador. Impede aceitar um índice externo adulterado junto do binário de cache.
- `scripts/package-public-catalog.mjs`: hook anterior à assinatura; copia somente arquivos íntegros do índice selecionado. Recusa preparação alterada depois do build. Não altera EXEs/DLLs nem lê perfil do analista.
- `desktop/__tests__/PublicCatalogCache.test.ts` e `scripts/__tests__/public-catalog-package.test.mjs`: incompatibilidade, adulteração, links, caminhos, reinício e restauração sem persistir chats. Testes simulados, não medições de desempenho.
- `src/components/DesktopSettings.tsx`: situação da IA, importação e exportação, sem pedir chave ou endereço.
- `desktop/evaluate.ts`: compara o modelo real ao corpus técnico; registra início antes de carregar o runtime, progresso e falhas sem copiar exceções brutas. O cliente de diagnóstico preserva o protocolo do aplicativo; o relatório registra protocolo e configuração real do runtime. `--inspect-facts` mostra somente interpretações do corpus sintético; não existe na telemetria do aplicativo. Mantém homologação operacional como pendente.
- `src/data/asphaltPilotCases.json`: 53 casos sintéticos de Asfalto, incluindo paráfrases, negação de falta, consulta sem ocorrência, ausências coordenadas e mistura de matching lexical com linguagem livre. Negativos também conferem associações permitidas; falha técnica não conta como interpretação correta de `null`. O comando `desktop:evaluate -- --corpus=asfalto` preserva o serviço de cada caso; `--prepared` usa o catálogo preparado como no aplicativo.
- `src/services/__tests__/AsphaltPrototype.test.ts`: regras nas duas áreas, negações, combinações, prioridade, resposta curta, contexto obrigatório e isolamento dos outros serviços.
- `desktop/EvaluationSummary.ts`: valida o progresso e resume divergências, consumo informado e latência separada por casos com e sem chamadas à IA. Uma rodada concluída pode ter divergências; uma falha sem casos não é aprovação.
- As avaliações sintéticas são salvas desde o início e após cada caso em `desktop-release/evaluations/`; `local-evaluation.json` contém a rodada mais recente, inclusive quando falhou ao iniciar. São artefatos de teste, não conversas dos analistas. Uma interrupção abrupta pode deixar estado `starting` ou `running`, sempre incompleto.
- `desktop/__tests__/ModelRuntime.test.ts`: limites do orçamento experimental de raciocínio e perfil de memória para 8/16 GB.
- `desktop/__tests__/ModelRuntimeLifecycle.test.ts`: inicialização, cancelamento, autenticação e falhas do processo simuladas; não mede inferência.
- `desktop/__tests__/EvaluationSummary.test.ts`: cálculos de métricas e coerência do progresso.
- `desktop/__tests__/EvaluationLifecycle.test.ts`: falha antes da inferência, preservação de resultados parciais e conclusão com divergências, sem iniciar executáveis reais.
- `src/ai/__tests__/LocalInterpretation.test.ts`: contrato de referência por evidências, alternativa por IDs e integração com o motor.
- `src/ai/__tests__/CompactLocalInterpretation.test.ts`: protocolo compacto, catálogo completo de classificatórias, campos desconhecidos, fontes, polaridade e contexto obrigatório, com clientes simulados. Não homologa o Qwen.
- `src/ai/__tests__/IndexedLocalInterpretation.test.ts`: contrato curto padrão, prefixo estável, identidade do serviço, IDs/trechos inválidos e proteção de evidência presente. Testes de contrato não medem o modelo real.
- `src/services/__tests__/QueryIntentClassifier.test.ts`: relato afirmativo, hipótese, consulta e uso reflexivo de “se”.
- `src/ai/__tests__/LocalMappingVerification.test.ts`: filtragem, narrativa incompatível, campos desconhecidos e falha segura da segunda chamada, com cliente simulado.
- `scripts/build-desktop.mjs`: compila renderer, processo principal e preload separadamente.
- `scripts/prepare-desktop-assets.mjs`: baixa runtime/modelo das fontes fixadas no lock, confere SHA-256 e extrai o ZIP plano com o tar do Windows. Usa pastas por versão e preserva a anterior. O runtime atual é a distribuição assinada da Unsloth, fork do llama.cpp.
- `scripts/verify-desktop-assets.mjs`: bloqueia o instalador se faltarem arquivos, hashes ou licenças.
- `scripts/check-signing-configuration.mjs`: preflight do instalador, antes de copiar arquivos; exige configuração sem exibir credenciais. Não comprova validade do certificado. O contrato TypeScript está em `check-signing-configuration.d.mts`, e os testes em `desktop/__tests__/SigningConfiguration.test.ts`.
- `scripts/check-desktop-security.mjs`: comando `desktop:doctor`, diagnóstico somente de leitura; retorna pendência quando faltam assinaturas ou não é possível consultar.
- `scripts/runtime-security.mjs`: valida pasta versionada, entradas do ZIP, inventário exato e contrato do diagnóstico. Exige EXEs/DLLs com assinatura válida na distribuição; não confunde eventos históricos com bloqueio atual.
- `scripts/inspect-runtime-security.ps1`: consulta Authenticode, estado do Smart App Control e eventos 3077 filtrados. Respeita a Execution Policy, não modifica o Windows e não executa o runtime.
- `scripts/verify-signed-runtime.mjs`: hook após assinatura; verifica a cópia empacotada, preserva hashes de origem em `signature-provenance.json` e registra hashes dos binários assinados. Não altera os arquivos originais baixados.
- `scripts/__tests__/runtime-security.test.mjs` e `signed-runtime-hook.test.mjs`: contratos de diagnóstico, bloqueio de distribuição e proteção do inventário; certificados e gravações são simulados.
- `scripts/finalize-desktop-package.mjs`: coloca a cópia do modelo ao lado do Setup, gera hashes e instruções de distribuição.
- `desktop/installer.nsh`: exige o modelo ao lado do Setup e o copia para a instalação, sem download.
- `desktop-resources/assets-lock.json`: versão, publicador, pasta e licença do runtime, mais identidade e hashes dos artefatos. Somente a pasta selecionada entra no pacote; pesos e binários ficam fora do Git.
- `electron-builder.json`: instalador Windows x64 com runtime e licenças; exige assinatura, inclui DLLs e chama a conferência após assinatura. Credencial real ainda depende da TI. Modelo auxiliar externo ao Setup, sem exigir Node no notebook do analista.

Os arquivos de regras instalados em `%APPDATA%/AEBOT` prevalecem sobre a base embarcada apenas se válidos e atuais. Uma importação substitui o motor e seu cache juntos. A interface recarrega o catálogo e limpa o caso para não misturar versões. O pacote anterior fica disponível em `.previous` para recuperação pela TI.

O restante deste mapa descreve o núcleo compartilhado e os perfis online anteriores, preservados durante a migração. Eles não são chamados pelo aplicativo offline. Veja `docs/ADR-001-DESKTOP-LOCAL.md` para os limites da primeira entrega.

## Atualização do protótipo em 08/10/2026

- `src/workspace.css`: layout compartilhado, com contexto à esquerda em janela larga e acima do chat em janela estreita. Sobrescreve o tema legado sem fontes remotas ou efeitos pesados.
- `src/components/ChatPanel.tsx`: invalida respostas atrasadas quando serviço/base mudam e mostra tempo real de espera, sem progresso inventado. A invalidação não cancela a inferência já em andamento.
- `desktop-resources/model-candidates.json`: identidades fixas de modelos experimentais; não muda a seleção do aplicativo.
- `scripts/prepare-model-candidate.mjs`: baixa candidato para arquivo parcial e só aceita após conferir tamanho e SHA-256; preserva os pesos anteriores.
- `desktop/evaluate.ts`: `--candidate=qwen35` ou `--candidate=qwen35lite` muda somente a rodada sintética. Modelo, hash e perfil ficam no relatório; não é uma opção do analista.
- `scripts/diagnose-model-start.mjs`: mede inicialização de candidato, sem perguntas ou conversas. Não faz parte da telemetria de uso.
- `electron-builder.prototype.json` e `scripts/package-prototype.mjs`: perfil portátil explícito, sem assinatura própria do AEBOT. Cria pasta nova, copia o modelo e verifica os hashes do runtime e dos arquivos finais. Preserva os bytes do runtime de IA e não enfraquece o build empresarial. O builder ainda insere integridade ASAR no EXE Electron; esse arquivo final não é anunciado como assinado nem idêntico ao host original.
- `scripts/__tests__/prototype-package.test.mjs` e `desktop/__tests__/ModelCandidate.test.ts`: contratos de separação dos perfis e identidade do modelo; não comprovam assinatura ou aceite em máquina corporativa.

O runtime usa `--no-warmup`: evita uma inicialização sintética prolongada, mas a primeira inferência continua fria e precisa entrar na medição de latência. Isso não garante resposta mais rápida. O cliente e os relatórios identificam o modelo selecionado pelo lock, sem rótulo fixo no painel.

O build gera `desktop-dist/model-install.nsh` a partir do lock; `desktop/installer.nsh` não mantém outro nome de GGUF. Preparação e verificação usam licença, origem fixa e hash do modelo selecionado, preservando a licença anterior. O modo `--aebot-package-check` do EXE empacotado usa perfil temporário, carga real do runtime e o mesmo smoke sintético; o relatório registra início/conclusão/falha e não persiste conversa.

No desktop, uma pergunta de contexto já cadastrada e vinculada a um cenário lexical forte sai diretamente do motor, sem esperar a IA ou permitir que ela invente equipe/posição. Paráfrases e relatos realmente ambíguos continuam passando pelo modelo. A polaridade do trecho original é revalidada antes de aceitar ocorrência ou ausência.

## Estratégia de IA online (legado)

O motor calcula uma avaliação técnica inicial, mas resultados informativos, orientativos ou ambíguos passam pela camada conversacional AI-first. O backend tenta `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `@cf/openai/gpt-oss-20b` e por fim `@cf/qwen/qwen3-30b-a3b-fp8`. Cada próximo modelo só é chamado diante de falha técnica, limite ou resposta fora do contrato. O catálogo do serviço e o histórico recente são apresentados ao modelo, que devolve simultaneamente os mapeamentos permitidos e uma resposta curta. O backend recalcula e valida a conclusão antes de liberar esse texto.

Informações pendentes são transportadas em `pendingInformation`; o backend não depende de reconhecer frases que ele mesmo escreveu. Assim, respostas curtas como “interna”, “terceirizada” ou o nome de uma superintendência continuam o caso correto sem transformar a pergunta pendente em fato da OS.

Essa ordem é configurável no Worker por `AEBOT_AI_PROVIDER_ORDER`. O padrão configurado é `gemini,workers-ai`. Somente esse perfil online dispensa um modelo na máquina; o desktop descrito acima depende do Qwen local.

Os provedores não são equivalentes em qualidade. O Gemini é mantido como principal por compreender melhor o português informal observado no piloto; o `gpt-oss-20b` é uma contingência online de raciocínio, não uma promessa de resposta idêntica. Respostas inválidas tentam o próximo modelo. Se toda a cadeia falhar, uma orientação ou explicação já fundamentada pelo motor é preservada; somente uma ausência real de correspondência vira `semantic_unavailable`.

Este arquivo é o mapa de manutenção do projeto. A ordem abaixo acompanha o caminho percorrido por uma pergunta, da extensão até a resposta e o feedback.

## 1. Visão geral

Além do desktop acima, o AEBOT preserva três partes executáveis legadas:

1. **Extensão Chrome** (`src`): mostra o side panel e conversa com a API.
2. **Cloudflare Worker** (`worker`): API online usada pelos analistas em produção.
3. **Servidor Node** (`server`): alternativa local para desenvolvimento e contingência.

As três partes usam o mesmo motor em `src/services`. As regras de negócio existem uma única vez, em `src/data/rulesStore.json`.

```text
Pergunta no side panel
  -> serviço selecionado
  -> contexto explícito da conversa
  -> API online
  -> normalização e identificação da intenção
  -> busca e comparação das regras
  -> resolução determinística da decisão
  -> IA opcional organiza a explicação
  -> resposta curta no side panel
```

A IA não decide. Ela pode reconhecer uma forma informal de escrever e melhorar o texto final, mas só pode usar regras e expressões já cadastradas.

## 2. Caminho de uma análise

### 2.1 Inicialização da extensão

- `manifest.json` declara o side panel, o service worker e as permissões da extensão Manifest V3.
- `src/background.ts` abre o side panel quando o usuário clica no ícone.
- `index.html` é a página carregada pelo Chrome.
- `src/main.tsx` monta o React.
- `src/App.tsx` carrega configurações, serviço, histórico e provider; depois conecta os componentes.

### 2.2 Interface e serviço selecionado

- `src/components/ServiceSelector.tsx` permite escolher o serviço.
- `src/components/ServiceDetails.tsx` mostra informações do serviço.
- `src/components/ChatPanel.tsx` mantém as mensagens e envia a pergunta atual separada do histórico. Isso evita duplicar a pergunta no prompt.
- `src/components/ConfigModal.tsx` configura API, credencial e opções locais.
- `src/components/FeedbackModal.tsx` envia somente o feedback digitado conscientemente pelo analista.

O `serviceId` escolhido na tela acompanha toda a avaliação. Serviço vazio ou desconhecido gera erro controlado; nunca existe troca silenciosa para outro serviço.

### 2.3 Transporte até o backend

- `src/ai/BackendClient.ts` faz as chamadas HTTP tipadas.
- `src/ai/BackendProvider.ts` usa a API como caminho principal e controla a contingência embarcada.
- `src/api/contracts.ts` define os contratos compartilhados da API.
- `src/api/FeedbackClient.ts` envia feedback.
- `src/api/feedbackContracts.ts` valida o formato do feedback.

O fallback embarcado só pode decidir quando conhece o serviço e comprova que a versão local da base é igual à versão central. Sem essa garantia, a resposta fica sem decisão.

### 2.4 Preparação do caso

- `src/services/ConversationContextResolver.ts` junta mensagens somente quando há continuação ou correção explícita. Um novo caso limpa o contexto.
- `src/services/TextNormalizer.ts` remove diferenças de acento, caixa, pontuação e espaços sem usar substring ingênua.
- `src/services/QueryIntentClassifier.ts` separa relato afirmativo, hipótese, pergunta informativa e intenção insuficiente.
- `src/services/SemanticInterpreter.ts` permite que o modelo associe linguagem livre somente a IDs cadastrados; a expressão técnica é escolhida pelo backend.
- `src/services/SemanticPolarity.ts` impede confundir ausência, evidência presente e formato incorreto.
- `src/services/ServiceParameterization.ts` consulta Troca, Adicional Executado e Adicional Posterior diretamente das relações cadastradas.

### 2.5 Recuperação e decisão

- `src/services/RuleRetriever.ts` encontra todas as regras aplicáveis, registra os motivos do match e trata condições orientadas pelos dados.
- `src/services/GroundedAdvisory.ts` transforma relações parciais confiáveis em orientação prática, sem criar conclusão oficial.
- `src/services/SemanticRuleRetriever.ts` acrescenta candidatos semânticos permitidos, sem criar regra nova.
- `src/services/ConflictResolver.ts` mantém o ranking anterior por padrão; com `decisionPolicy: most_severe_applicable`, a conclusão mais grave prevalece entre regras já aplicáveis. Não usa regras meramente relacionadas para decidir.
- `src/services/RuleRetriever.ts` confere também `mandatoryConditionGroups`: todos os grupos precisam de uma alternativa presente no relato original, inclusive quando a regra veio do modelo. Isso impede inventar equipe ou posição do adicional para satisfazer uma regra.
- `src/services/RuleEngine.ts` recebe texto em `evaluatePrompt` ou fatos rastreáveis em `evaluateFacts`; compartilha a avaliação final e devolve decisão, evidências, conflitos, confiança e necessidade de validação humana.
- `src/services/ResponseFormatter.ts` gera a resposta curta de contingência.
- `src/services/AnalysisService.ts` executa o mesmo fluxo na extensão, no servidor Node e no Worker.

Se nenhuma regra classificatória realmente aplicável for encontrada, `decision` é `null`. Quando existem regras ou conceitos próximos, o resultado `advisory` informa o direcionamento, a base consultada e o que falta confirmar. Ausência real de relação continua como `insufficient`. O sistema não usa decisão padrão para aprovar.

### 2.6 Uso opcional de IA

- `src/ai/StructuredModelClient.ts` define o contrato que qualquer modelo deve cumprir.
- `src/ai/WorkersAiModelClient.ts` integra a contingência online do Cloudflare Workers AI.
- `src/ai/AnalysisProvider.ts` coordena o motor e qualquer cliente estruturado configurado.
- `src/ai/GeminiModelClient.ts` integra o transporte HTTP legado do Gemini.
- `src/ai/GeminiProvider.ts` preserva os imports históricos por reexportação.
- `src/ai/ModelContents.ts` prepara histórico recente e pergunta atual, sem duplicação.
- `src/ai/PromptBuilder.ts` entrega ao modelo a avaliação já calculada e proíbe alteração da decisão.

O modelo compreende linguagem informal, referências ao histórico e frases incompletas, responde em até quatro frases e faz no máximo uma pergunta por vez. A decisão recebida do motor é imutável; se o texto do modelo contrariá-la, ele é descartado e entra o formatador curto de contingência.

### 2.7 Resposta e feedback

- A resposta volta pelo backend e é exibida por `ChatPanel.tsx`.
- O feedback segue para `POST /v1/feedback` sem copiar automaticamente a conversa.
- `worker/feedbackRepository.ts` grava o registro no D1.
- `worker/adminPage.ts` fornece a página protegida para métricas operacionais e feedbacks.
- `worker/metricsRepository.ts` agrega uso por dia, analista, modelo e estado técnico sem persistir o conteúdo do chat.

## 3. Fonte de verdade e dependências

As dependências devem apontar nesta direção:

```text
dados e tipos
  -> serviços puros do motor
  -> orquestração da análise
  -> API/providers
  -> interface e pontos de entrada
```

Regras que evitam acoplamento:

- regra de negócio fica no JSON, nunca em `RuleEngine` ou componentes;
- a interface não calcula decisão;
- providers e modelos não alteram decisão;
- Worker e Node reutilizam `AnalysisService`;
- arquivos de teste podem conhecer casos reais, mas o motor genérico não conhece IDs `RULE-RC`;
- tokens e chaves ficam fora do repositório.

## 4. Pastas e arquivos

### Raiz

- `AGENTS.md`: decisões permanentes que futuras manutenções precisam respeitar.
- `ARQUITETURA.md`: este mapa do código.
- `PROJETO.md`: visão do produto, requisitos e planejamento das sprints.
- `README.md`: instalação, comandos e operação diária.
- `package.json`: dependências, versão e comandos do projeto.
- `package-lock.json`: versões exatas instaladas pelo npm.
- `manifest.json`: manifesto-fonte da extensão.
- `index.html`: entrada HTML do side panel.
- `vite.config.ts`: build da extensão e cópia do service worker/manifesto.
- `vite.server.config.ts`: build da API Node.
- `wrangler.jsonc`: configuração, bindings e limites do Cloudflare Worker.
- `tsconfig.json`: TypeScript da extensão e do código compartilhado.
- `tsconfig.node.json`: TypeScript dos arquivos de build e scripts compatíveis.
- `tsconfig.server.json`: TypeScript da API Node.
- `tsconfig.worker.json`: TypeScript do Worker.
- `.env.example`: nomes das variáveis locais, sempre sem segredos.
- `.gitignore`: arquivos gerados e privados que não entram no Git.

### `src` — extensão e núcleo compartilhado

- `main.tsx`: entrada do React.
- `App.tsx`: composição da tela, estado persistido e escolha do provider.
- `background.ts`: service worker Manifest V3.
- `styles.css`: tema e layout do side panel.
- `types.ts`: tipos de serviço, regra, avaliação e mensagens.
- `localConfig.ts`: leitura segura das configurações locais de build.
- `chrome.d.ts`: tipos mínimos das APIs Chrome usadas pelo projeto.
- `vite-env.d.ts`: tipos fornecidos pelo Vite.

#### `src/components`

- `ChatPanel.tsx`: conversa, envio, estados de carregamento e exibição da avaliação.
- `ConfigModal.tsx`: configurações operacionais da instalação.
- `FeedbackModal.tsx`: formulário de feedback voluntário.
- `ServiceDetails.tsx`: resumo do serviço selecionado.
- `ServiceSelector.tsx`: seleção explícita do serviço.

#### `src/data`

- `rulesStore.json`: serviços e regras de negócio; é a fonte de verdade funcional. Regras idênticas entre variações usam `applicableServiceIds`, evitando cópias que poderiam divergir.
- `languageAliases.json`: abreviações e equivalências gerais de linguagem.
- `regressionCases.json`: frases reais que protegem o comportamento esperado da base.
- `schemas/rulesStore.schema.json`: autocomplete e validação visual dos campos no VS Code.
- `.vscode/settings.json`: associa o schema ao arquivo da base para reduzir erros de digitação.

#### `src/services`

- `AnalysisService.ts`: fachada compartilhada que executa uma análise completa.
- `ConversationContextResolver.ts`: continuação, retificação e novo caso.
- `AnalysisCoverage.ts`: cobertura lexical do relato e proteção contra conclusão parcial.
- `FactSources.ts`: segmentação de fatos negativos, preservando citações e conectivos.
- `TextNormalizer.ts`: normalização e tokens inteiros.
- `QueryIntentClassifier.ts`: intenção e força da afirmação.
- `RuleRetriever.ts`: recuperação, score e motivos de correspondência.
- `GroundedAdvisory.ts`: orientação segura para correspondências parciais.
- `SemanticRuleRetriever.ts`: combinação segura de candidatos semânticos.
- `SemanticInterpreter.ts`: valida a interpretação limitada produzida pela IA.
- `SemanticPolarity.ts`: valida a polaridade linguística antes de aplicar a regra.
- `ConflictResolver.ts`: escolhe a regra principal sem descartar as demais.
- `RuleEngine.ts`: coordena o resultado determinístico tipado.
- `ResponseFormatter.ts`: formata respostas sem depender de IA.
- `RuleStoreValidator.ts`: valida a estrutura da base em tempo de execução, inclusive os serviços compartilhados por uma regra.
- `ServiceCatalogService.ts`: expõe catálogo e versão da base.
- `ServiceParameterization.ts`: transforma as relações entre serviços em respostas informativas, sem calcular decisão.
- `KnowledgeService.ts`: consulta detalhes e regras de um serviço.
- `__tests__`: testes unitários e corpus de regressão do motor.

#### `src/ai`

- `BackendClient.ts`: cliente HTTP da API.
- `BackendProvider.ts`: provider usado pela extensão e política de fallback.
- `AnalysisProvider.ts`: orquestra motor, interpretação, conferência e resposta.
- `GeminiProvider.ts`: compatibilidade dos imports históricos.
- `GeminiModelClient.ts`: transporte HTTP do Gemini e configuração do Chrome legado.
- `ModelContents.ts`: montagem do histórico e da mensagem atual.
- `PromptBuilder.ts`: prompts restritos ao resultado e às regras recuperadas.
- `StructuredModelClient.ts`: interface comum para modelos.
- `WorkersAiModelClient.ts`: adaptador do modelo online executado no Cloudflare.
- `__tests__`: contratos, falhas e garantias dos providers.

#### `src/api`

- `contracts.ts`: requisições e respostas da análise e do catálogo.
- `FeedbackClient.ts`: cliente HTTP do feedback.
- `feedbackContracts.ts`: tipos e validação de feedback.
- `__tests__`: testes dos contratos e do cliente.

#### Apoio da extensão

- `src/constants/storageKeys.ts`: nomes únicos das chaves persistidas.
- `src/storage/StorageAdapter.ts`: usa `chrome.storage` e memória controlada em testes.
- `src/state/usePersistentState.ts`: hook React para estado persistente.
- `src/repositories/serviceRepository.ts`: acesso local ao catálogo embarcado.

### `worker` — backend online

- `index.ts`: entrada do Cloudflare Worker.
- `app.ts`: rotas, autenticação, CORS, limites e chamada do serviço de análise.
- `feedbackRepository.ts`: operações tipadas no banco D1.
- `adminPage.ts`: HTML, CSS e JavaScript da página administrativa.
- `migrations/0001_feedback.sql`: criação inicial da tabela de feedback.
- `migrations/0002_operational_metrics.sql`: métricas agregadas de atividade e tentativas de IA.
- `__tests__`: testes de API, segurança, capacidade e banco simulado.

### `server` — backend Node local

- `index.ts`: inicia o servidor HTTP.
- `app.ts`: rotas, CORS, autenticação e limites locais.
- `analysisService.ts`: monta as dependências do serviço compartilhado.
- `config.ts`: interpreta configurações locais.
- `environment.ts`: acesso tipado às variáveis de ambiente.
- `contracts.ts`: valida entradas recebidas pelo servidor.
- `__tests__`: testes da alternativa Node.

### `scripts` — operação e validação

- `audit-rules.mjs`: procura lacunas, duplicidades e conflitos na base.
- `validate-extension.mjs`: confere o artefato Manifest V3.
- `validate-production-extension.mjs`: garante que o build de produção só acesse a API oficial.
- `validate-server.mjs`: confere o bundle Node.
- `check-server.mjs`: teste rápido da API Node em execução.
- A saúde dos provedores online é verificada pelo backend e pelos diagnósticos de implantação.
- `setup-local-server.mjs`: prepara a configuração local sem versionar segredo.
- `configure-production-extension.mjs`: aplica URL e identidade estável no `dist`.
- `configure-cloudflare-secrets.mjs`: envia hashes e configurações privadas ao Cloudflare sem imprimi-los.
- `generate-access-tokens.mjs`: cria credenciais individuais dos analistas.
- `generate-admin-token.mjs`: cria a credencial separada do painel administrativo.
- `generate-extension-identity.mjs`: cria e preserva a identidade estável da extensão.
- `token-provisioning.mjs`: funções puras de geração, hash e serialização de tokens.
- `verify-production-deployment.mjs`: testa catálogo, análise, feedback e painel publicados.
- `run-capacity-test.mjs`: executa o teste de 3.000 avaliações isoladamente.
- `__tests__`: testes das rotinas de provisionamento.

### `docs` — operação e governança

- `DEPLOYMENT-40-USERS.md`: publicação e distribuição para os 40 analistas.
- `CAPACITY-3000-OS.md`: premissas de volume, limites e teste de capacidade.
- `OPERACAO-PILOTO-E-PROVEDORES.md`: ordem dos modelos, cotas, privacidade e roteiro operacional.
- `RULE-INTAKE.md`: processo para cadastrar e revisar regras.
- `COMO-EDITAR-REGRAS.md`: manutenção prática da base com exemplos seguros.
- `BASE-DE-CONHECIMENTO-ITS.md`: critérios extraídos das ITs e seus limites classificatórios.

### Arquivos de teste

Os testes ficam perto da parte que protegem:

- `src/services/__tests__/ConversationContextResolver.test.ts`: novo caso, continuação e correção de fatos.
- `src/services/__tests__/RegressionCorpus.test.ts`: todas as frases cadastradas no corpus de regressão.
- `src/services/__tests__/RuleEngine.test.ts`: decisões, intenções, conflitos, múltiplas regras e serviços.
- `src/services/__tests__/StructuredEvaluation.test.ts`: entrada direta dos fatos, citações, isolamento do serviço, exceções, condições obrigatórias e combinação segura de regras.
- `src/services/__tests__/RuleStoreValidator.test.ts`: schema e integridade da base.
- `src/services/__tests__/SemanticInterpreter.test.ts`: limites da interpretação feita pelo modelo.
- `src/services/__tests__/SemanticRuleRetriever.test.ts`: união segura de matches textuais e semânticos.
- `src/services/__tests__/ServiceCatalogService.test.ts`: catálogo e versão central.
- `src/services/__tests__/ServiceParameterization.test.ts`: relações, desdobros e proteção contra correspondência parcial.
- `src/ai/__tests__/BackendClient.test.ts`: requisições, respostas e falhas HTTP.
- `src/ai/__tests__/BackendProvider.test.ts`: backend preferencial e regras do fallback.
- `src/ai/__tests__/GeminiProvider.test.ts`: decisão imutável, histórico e humanização.
- `src/ai/__tests__/WorkersAiModelClient.test.ts`: contrato do modelo Cloudflare.
- `src/api/__tests__/FeedbackClient.test.ts`: envio e erros do feedback.
- `src/api/__tests__/feedbackContracts.test.ts`: validação e limpeza dos campos de feedback.
- `server/__tests__/analysisService.test.ts`: montagem da análise no Node.
- `server/__tests__/app.test.ts`: rotas, CORS, autenticação e limites do Node.
- `server/__tests__/config.test.ts`: leitura da configuração local.
- `server/__tests__/contracts.test.ts`: validação das entradas da API Node.
- `server/__tests__/environment.test.ts`: variáveis de ambiente permitidas.
- `worker/__tests__/app.test.ts`: rotas, autenticação, CORS e limites do Worker.
- `worker/__tests__/capacity.test.ts`: 3.000 avaliações determinísticas em lote.
- `worker/__tests__/feedbackRepository.test.ts`: persistência e filtros de feedback.
- `worker/__tests__/fakeD1.ts`: banco D1 em memória usado somente pelos testes.
- `scripts/__tests__/token-provisioning.test.mjs`: geração, hash e validação de credenciais.

### Pastas geradas ou privadas

- `dist`: extensão pronta para carregar no Chrome; é recriada pelo build.
- `server-dist`: bundle gerado da API Node.
- `worker-dist`: saída temporária da validação do Worker.
- `node_modules`: dependências instaladas; nunca editar manualmente.
- `.wrangler`: estado local das ferramentas Cloudflare.
- `.aebot-private`: tokens, hashes e identidade da extensão. É ignorada pelo Git e deve ter backup seguro.
- `.git`: histórico interno do repositório.

## 5. Manutenções comuns

### Adicionar ou alterar uma regra

1. Edite `src/data/rulesStore.json`.
2. Atualize a versão da base.
3. Acrescente exemplos reais em `src/data/regressionCases.json`.
4. Rode `npm run rules:check` e os builds.
5. Publique o Worker e gere novamente o `dist` de produção.

Não escreva a regra em TypeScript para “ajudar” o motor.

### Adicionar um serviço

Cadastre o serviço uma única vez no `rulesStore.json`. Se as regras ainda não foram fornecidas, use `analysisStatus: "rules_pending"`; o serviço já poderá ser referenciado como original ou parametrizado, mas não produzirá decisão. Quando as regras forem cadastradas, altere o status para `active`, crie regressões próprias e valide a seleção pelo `serviceId`. Nenhum fallback deve apontar para o primeiro serviço.

As opções de outro serviço devem referenciar o ID já existente em `parameterization.serviceExchange`, `executedAdditional` ou `subsequentAdditional`. Não copie o cadastro do serviço para cada lista. Se uma captura cortar o nome, registre `catalogNameStatus: "needs_confirmation"` e preserve o trecho visível em `sourceLabel` até receber o rótulo completo.

### Melhorar entendimento de linguagem

- equivalência geral, como abreviação: `languageAliases.json`;
- equivalência de negócio: regra correspondente em `rulesStore.json`;
- comportamento genérico de frase: normalizador, classificador ou recuperador, sempre com teste.

### Alterar a interface

Comece em `App.tsx` e `src/components`; mantenha a decisão fora dos componentes. O tema legado fica em `styles.css`, e o layout compartilhado atual em `src/workspace.css`.

### Trocar o provedor de IA

Implemente `StructuredModelClient`, conecte-o na composição do backend e preserve os testes que impedem alteração de decisão.

### Alterar a API online

Edite `worker/app.ts`, atualize contratos compartilhados se necessário, teste e publique. Mudança de banco exige uma nova migração numerada; não edite uma migração já aplicada.

## 6. Validação antes de publicar

```powershell
npm test
npm run test:capacity
npm run rules:audit
npm run typecheck
npm run build:production
npm run build:server
npm run build:worker
```

Depois do deploy, execute `npm run deployment:check -- https://aebot-api.pedrolucasbotelho.workers.dev`. O diagnóstico cria, consulta e remove automaticamente seu próprio feedback técnico.

Antes de entregar, confira também o diff, os imports, o manifesto gerado e a ausência de segredos fora de `.aebot-private`.
