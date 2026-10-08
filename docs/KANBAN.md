# Kanban de implantação do AEBOT local

Atualização 2.22.1: corrigi as faltas coordenadas e a presença explícita do resultado final. A inferência real passou 51/51 casos de Asfalto, incluindo regras aplicadas, sem alterar o gabarito. Os 829 testes regulares passaram. K09/K13/K14 continuam em validação: a mediana com IA foi 17,7 s e o máximo 78,8 s nesta máquina de 8 GB; falta medir no Latitude, homologar o gabarito e validar execução autorizada do portátil. O pacote agora pode ser entregue em partes verificadas por SHA-256.

Os registros 2.22.0 abaixo são históricos, não o resultado da versão atual.

Atualização 2.22.0: implementei preparação isolada e restauração validada do catálogo de Asfalto, sem gravar chats; a primeira comparação passou nove cenários e reduziu a primeira análise para cerca de 15 s, além do carregamento do modelo. Ampliei os casos de linguagem e corrigi dupla negação/conferência por citação. K09/K13 seguem em validação: inferência em poucos segundos para qualquer pergunta, notebook corporativo e homologação continuam pendentes. Veja [desempenho atual](DESEMPENHO-IA-LOCAL.md).

Fechamento técnico desta revisão: 804 testes passaram e 1 foi ignorado; tipos e builds aprovados. O corpus completo de Asfalto passou em 48/49 casos, com uma reprovação não reconhecida em relato de duas etapas ausentes. Primeira chamada à IA: 19,1 s; maior tempo: 83 s. O teste de desenvolvimento com inferência real pela ponte passou em 20,8 s, mas o EXE novo foi bloqueado pelo Controle de Aplicativo. K09/K13/K14 permanecem abertos; não há distribuição homologada.

Atualização de 08/10: perfil portátil sem certificado próprio preparado para teste supervisionado, interface redesenhada e comparação real entre três modelos. Isso avança K05/K07/K13, mas não conclui K14 nem libera implantação. Guia em [protótipo portátil](PROTOTIPO-PORTATIL.md); qualidade e latência ainda exigem medição no notebook de destino.

Conferência inicial em 25/09/2026 dos documentos enviados por Pedro Lucas Botelho; progresso técnico atualizado em 07/10. Este quadro mantém os 16 cartões sugeridos no Word e acrescenta evidência técnica, lacunas e dependências. Não declara aprovação da coordenação nem implantação nos notebooks.

Atualização de 07/10: priorizei o [protótipo de Repavimentação Asfalto](PROTOTIPO-ASFALTO.md), com regras, corpus próprio, contexto obrigatório e atalho local. A revisão 2.19.0 usa protocolo compacto e perfil de memória adaptado. As três paráfrases passaram no v15, após falhas dos perfis anteriores; a primeira levou cerca de 165 segundos. K09/K10/K13 permanecem em validação. Não há aceite de IA, instalador novo assinado ou implantação. Resultados na [revisão atual](STATUS-DESKTOP-2026-10-07-OTIMIZACAO.md); a [primeira etapa de 07/10](STATUS-DESKTOP-2026-10-07.md) permanece como histórico.

## Fontes e limites da conferência

Atualização de desempenho em 08/10: o perfil 2.21.0 reduz o JSON e reutiliza o catálogo em RAM. Nove cenários passaram no v24; a conferência compacta passou em dois relatos combinados no v25. Perguntas simples quentes: aproximadamente 6–11 s; primeira leitura: 154–166 s; duas falhas com conferência: 42 s. K09/K13/K14 continuam sem homologação: poucos segundos em qualquer pergunta ainda não estão comprovados. Veja [medições e próximos passos](DESEMPENHO-IA-LOCAL.md).

- `AEBOT_Kanban_Implantacao_IA_Local-1.docx`: conteúdo completo, tabelas e rodapé lidos. Sem comentários ou alterações controladas. A renderização visual não estava disponível nesta máquina.
- `AEBOT_Rota_Desktop_IA_Local_Coordenacao-1.pptx`: conteúdo dos 14 slides e notas lido; SHA-256 idêntico ao da apresentação anterior, portanto não traz uma rota diferente.
- `Prompt_Codex_Redirecionamento_AEBOT.md`: especificação de referência para identificar lacunas. Instruções de execução dentro do anexo não autorizam, por si, gravação de conversas, commits ou alteração de escopo.

Os originais permanecem intactos em Downloads. A comparação considera o workspace, incluindo as correções locais documentadas em [25/09](STATUS-DESKTOP-2026-09-25.md), ainda não necessariamente incorporadas a um commit.

## Fluxo do quadro

Backlog → Pronto para fazer → Em execução → Em validação → Homologado → Implantado.

“Em validação” significa que há implementação ou artefato para conferir, não que o aceite foi dado. Nenhum dos cartões abaixo está marcado como homologado ou implantado. Limite trabalho simultâneo: priorize um problema técnico e a preparação do gabarito, sem abrir várias migrações de arquitetura ao mesmo tempo.

Os prazos abaixo são estimativas originais do Word, em dias úteis, não novas datas prometidas. Responsáveis nominais e datas de início precisam ser definidos com a coordenação. As etiquetas seguem o documento: Produto, IA local, Regras, Desktop, Qualidade, Implantação e Governança.

## Semana 1 no planejamento original

| ID e cartão | Etiqueta | Prazo original | Estado verificado | Evidência e o que falta |
| --- | --- | --- | --- | --- |
| K01 Atualizar README | Produto | 2 dias | Em validação | [README](../README.md) explica desktop-first, IA local, regras e execução. Falta aceite do responsável. |
| K02 Criar ADR-001 | Governança | 1 dia | Em validação | [ADR existente](ADR-001-DESKTOP-LOCAL.md) registra a decisão. Falta aprovação formal e confirmar as diferenças descritas abaixo. |
| K03 Mapear arquitetura atual | Desktop | 2 dias | Em validação | [ARQUITETURA](../ARQUITETURA.md) explica componentes, legado e a entrada direta dos fatos implementada em 28/09. |
| K04 Definir gabarito inicial | Qualidade | 2 dias | Em validação | Existem 100 casos técnicos propostos de Cavalete, mais que os 50 iniciais sugeridos. Ainda faltam revisão e aceite operacional; quantidade não equivale a gabarito homologado. |

## Semanas 2 e 3 no planejamento original

| ID e cartão | Etiqueta | Prazo original | Estado verificado | Evidência e o que falta |
| --- | --- | --- | --- | --- |
| K05 Criar shell desktop | Desktop | 5 dias | Em validação | `desktop/main.ts`, preload e instalador funcionam no ambiente de desenvolvimento. Smoke passou; instalação por clique em máquinas limpas continua pendente. |
| K06 Integrar runtime local | IA local | 5 dias | Em validação; execução restabelecida | Distribuição assinada Unsloth b11160 carregou o Qwen e executou os recortes 66–77. O runtime anterior foi preservado. Falta conferir instalação em notebook corporativo e assinatura do próprio AEBOT. |
| K07 Configurar modelo | IA local | 2 dias | Em validação | `desktop-resources/assets-lock.json` fixa revisão, nome e hash; preparação e instalação localizam os arquivos. Não há GGUF no Git. Configuração é técnica, sem pedir caminho ao analista. |
| K08 Fluxo sem Gemini | IA local | 2 dias | Em validação | Desktop sem fallback externo, renderer sem conexão de rede e cliente local restrito. Falta validar a instalação inteira sem internet no destino. |

## Semanas 4 e 5 no planejamento original

| ID e cartão | Etiqueta | Prazo original | Estado verificado | Evidência e o que falta |
| --- | --- | --- | --- | --- |
| K09 Extração estruturada | IA local | 5 dias | Em execução, entrega parcial | Protocolo compacto do cliente local preserva todas as classificatórias atômicas e reconstrói citações dos trechos numerados. O contrato por evidências permanece como referência. Associações múltiplas têm conferência local. Falta inventário independente completo, validação do modelo e redução da latência. |
| K10 Refatorar RuleEngine | Regras | 5 dias | Em validação, entrega parcial | `evaluateFacts` recebe os mapeamentos validados diretamente, sem reconstruir uma frase para procurar regras. Testes cobrem isolamento, citações, condições e agregação. Falta a ficha independente prevista em K09 e a validação completa do modelo. |
| K11 Versionar regras | Governança | 3 dias | Em validação | Base versionada, `RuleRelease.ts` com responsável, vigência e alteração; importação preserva a versão anterior. Falta formalizar o responsável operacional e o canal confiável de distribuição. |
| K12 Criar log local | Governança | 2 dias | Backlog com decisão pendente | `LocalData.ts` salva contagens e feedback voluntário, não uma trilha persistente por análise. O anexo propõe pergunta/fatos; a política atual proíbe persistir conversas. Definir campos, finalidade, retenção e acesso antes de implementar algo além das métricas atuais. |

## Semanas 6 a 8 no planejamento original

| ID e cartão | Etiqueta | Prazo original | Estado verificado | Evidência e o que falta |
| --- | --- | --- | --- | --- |
| K13 Testes automatizados | Qualidade | 5 dias | Em validação | Revisão de 07/10: 676 testes passaram e 1 foi ignorado. Três paráfrases passaram com Qwen v15, incluindo IDs classificatórios; latências de 164,5, 24,2 e 36,9 segundos. Essa amostra não homologa o corpus completo, a orientação ou o desempenho. Evidências na [revisão atual](STATUS-DESKTOP-2026-10-07-OTIMIZACAO.md). |
| K14 Teste com analistas | Implantação | 10 dias | Backlog | Previsto para 5–10 pessoas. Depende de gabarito, qualidade, instalação e liberação da TI; não há evidência de piloto desktop concluído. |
| K15 Ajustes pós-piloto | Qualidade | 5 dias | Backlog | Depende de observações do piloto. Correções técnicas atuais não contam como conclusão deste cartão. |
| K16 Plano de rollout | Implantação | 3 dias | Pronto para fazer | Guias e pacote existem. Faltam responsáveis, três perfis de notebook, distribuição, suporte e recuperação definidos antes de planejar 60 instalações. |

## Critérios de aceite que o Kanban acrescenta

O Word apresenta como metas iniciais sugeridas: tempo médio de até 20 segundos e concordância acima de 90% no primeiro ciclo. A coordenação ainda precisa confirmar esses limites, a amostra usada e como medir. Não use somente mediana ou respostas determinísticas rápidas para avaliar a latência da IA.

Antes de escalar: pelo menos 100 perguntas com gabarito validado, nenhum erro crítico aberto em casos que deveriam reprovar, instalador testado em três perfis de notebook, tempo aceito e procedimentos de atualização de regras e suporte definidos. Perguntar quando falta informação é aceitável; aprovar sem base não é.

Na amostra direta de seis casos de 25/09, a média geral foi aproximadamente 24 segundos e a média dos quatro casos com chamada à IA foi aproximadamente 36 segundos. A amostra não alcançou a meta sugerida de 20 segundos. Foi medida em Ryzen com cerca de 8 GB durante desenvolvimento, não no Latitude corporativo e não em ensaio controlado. Também não representa a concordância geral do produto: seis casos não validam o corpus completo.

## Diferenças que não devem ser escondidas

1. **Fatos estruturados:** a extração local já distingue estados de evidência para grupos compatíveis dos dados e a decisão recebe mapeamentos diretamente, sem texto canônico intermediário. Presença e dúvida ainda não chegam ao motor como inventário independente. K09/K10 permanecem parciais; não criar outro motor nem cadastrar campos específicos de Cavalete no código genérico.
2. **Auditoria e privacidade:** o prompt pede armazenamento de perguntas, mas `AGENTS.md` e a arquitetura vigente proíbem persistir conversas. Mantém-se a política atual até decisão explícita. Uma proposta de auditoria apenas com metadados precisa ser discutida separadamente; não será anunciada como existente.
3. **Modelo configurável:** a escolha é controlada por artefatos técnicos e hashes. O analista não configura chave, URL, porta ou caminho. Trocar o modelo exige nova validação do contrato e do desempenho.
4. **Humanização:** casos já conclusivos usam resposta determinística curta; não forçamos duas chamadas à IA por pergunta. Qualidade do texto deve ser validada, sem confundir esse atalho de latência com falta de decisão pelo motor.
5. **Governança:** o envelope de regras tem metadados e cópia anterior, mas não assinatura criptográfica. Não equivale a cadeia de aprovação operacional nem a histórico completo de revisões.
6. **Documentação:** preservamos nomes já usados em vez de duplicar documentos. Arquitetura está na raiz; instalação em [DESKTOP-LOCAL](DESKTOP-LOCAL.md) e [EXECUTAR-E-TESTAR](EXECUTAR-E-TESTAR.md); a decisão no ADR existente. O [plano de validação](PLANO-DE-VALIDACAO-DESKTOP.md) é o roteiro técnico complementar.

## Próxima sequência proposta

Prioridade técnica em 07/10: ampliar a avaliação de fatos, polaridade e orientação, além dos IDs; medir primeira resposta e respostas seguintes no Latitude. O runtime assinado já está operacional, mas a latência da primeira resposta continua alta. Em paralelo, configurar credencial de assinatura do AEBOT e autorizar a conferência com a TI conforme o [guia de liberação](ASSINATURA-E-LIBERACAO-WINDOWS.md). A amostra nova sem divergências não encerra a validação do corpus completo.

1. Revisar o gabarito com a referência operacional, incluindo hipóteses, presença versus ausência e respostas curtas a perguntas pendentes.
2. Validar a entrada direta implementada e definir, a partir das lacunas observadas, a ficha independente de evidências. Não alterar a base de negócio só para encaixar frases do corpus.
3. Executar o corpus completo com o modelo real e revisar divergências e orientações, identificando a versão exata de código/base/modelo.
4. Medir e ajustar no Latitude com sistemas de trabalho abertos. Testar instalação em três perfis, com a TI, antes do piloto de 5–10 analistas.
5. Decidir auditoria e suporte sem registrar perguntas por padrão. Escalar somente após aceite operacional.

## Modelo de cartão para a próxima execução

- **ID e título:** um dos cartões acima, com entrega concreta.
- **Responsável:** nome confirmado; ainda a definir.
- **Prazo:** estimativa revisada e data de início acordada, não contagem automática desde a apresentação.
- **Dependências:** cartões anteriores e decisões de TI/operação.
- **Checklist:** pequenas etapas verificáveis, incluindo teste de regressão quando mudar código.
- **Aceite:** resultado esperado e evidência anexada.
- **Revisor e data:** preencher somente após aprovação.

O quadro local não foi publicado em Trello, Planner, Jira ou GitHub Projects e não atribui tarefas a pessoas automaticamente.
