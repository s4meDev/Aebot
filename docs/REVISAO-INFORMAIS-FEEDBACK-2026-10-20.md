# Revisão 0.3.0 — relatos informais e feedback

**Data:** 20/10/2026. **Rota:** Python/Tkinter, BGE/ONNX offline. **Base:** 2.18.0. O relatório da 0.2.0 foi preservado como histórico; seus tempos não são atribuídos a esta revisão.

## O que mudei

- Separei objeto, ocorrência e etapa. “Sem legenda na foto” não significa “sem foto”; o estado ruim antes da execução não comprova acabamento final ruim.
- Ampliei plurais, voz passiva, omissões, palavras intermediárias e referências entre orações, mantendo a citação literal e o contexto que sustentam cada associação.
- O modelo recebe o serviço real e compara os grupos elegíveis desse catálogo. Não exijo uma palavra de uma lista de defeitos para consultar a IA. Condições, exceções e contexto continuam obrigatórios.
- As etapas valem por oração. Equipe, frente e possibilidade de troca são contextos explícitos na base; a retificação substitui o dado antigo, sem apagar outra falha ou misturar origem/adicional.
- Mantenho uma segunda organização dos mesmos textos quando a primeira comparação fica ambígua, sem reduzir o limiar ou acrescentar fatos. Isso custa tempo em parte das frases.
- Corrigi um falso positivo encontrado durante a revisão: uma foto informada como presente não deve virar uma medição incoerente. Consultas sem relato de irregularidade buscam o assunto sem disputar uma falha como se tivesse ocorrido.
- A amostra adicional de 20 casos revelou falta de interpretação de “ninguém mostrou”, retificação “só falta antes” e uma regra genérica extra ao comparar valores em duas orações. Corrigi esses pontos por construção gramatical/contexto, mantendo os gabaritos originais. Depois dessas correções, essa amostra passa a ser regressão, não teste cego.
- Cache é limitado à memória do caso e considera texto original, contexto, serviço, base e candidatos. Novo caso, inclusive escrito no chat, limpa as interpretações anteriores.

As conclusões e orientações continuam no `rulesStore.json`. Não copiei regras para Python, não alterei as três conclusões oficiais nem baixei outro modelo para a entrega. BGE mede relevância: não é um LLM conversacional nem uma prova formal de que um fato ocorreu. Se a associação não for suficiente, peço esclarecimento ou mantenho a análise sem decisão.

## Feedback, sem métricas

Implementei formulário voluntário, leitura/busca local e exportação/importação JSON. O responsável pediu **somente feedback** nesta etapa: não há métricas persistentes nem gravação automática do chat.

O formulário começa vazio. Salvo descrição, orientação esperada opcional, categoria, serviço, data, ID e versões. O banco fica no perfil Windows, fora da pasta do aplicativo. Importações inválidas ou conflitantes são recusadas inteiramente; reenviar o mesmo registro não duplica. Feedback não altera regra ou modelo automaticamente. Veja `docs/FEEDBACK-PYTHON.md` ou `GUIA-FEEDBACK.md` no pacote.

## Validação desta entrega

**Checkpoint solicitado antes de encerrar os créditos: código salvo, ainda não é entrega homologada.**

- Python: **66 testes de unidade aprovados**, incluindo feedback, retificações e proteção contra falsos positivos conhecidos.
- Legado: **875 testes aprovados, um ignorado**; typecheck e build aprovados. Validador Manifest V3 e integridade da base aprovados; 36 serviços, 100 regras, sem avisos de governança.
- A primeira auditoria completa desta rodada teve 1.230 cenários × 3 repetições: 1.226 completos e 1.228 decisões esperadas. Ela encontrou um falso positivo e consultas mal recuperadas; corrigi esses caminhos depois. Esse resultado **não mede o código final**.
- A amostra adicional inicial de 20 casos teve 17 completos e 18 decisões esperadas, sem decisão oficial incorreta; suas três divergências motivaram as correções gramaticais descritas acima. Não alterei o gabarito.
- A repetição completa e a janela real estavam em andamento neste checkpoint. Ainda é preciso repetir a aceitação e a auditoria com todos os últimos fontes, concluir o teste visual/funcional, gerar o EXE 0.3.0 e testá-lo antes de criar o ZIP.

Não apresento tempos intermediários como medição final: parte da rodada coincidiu com testes do legado. A próxima medição deve ser serial, sem outra suíte pesada concorrendo. Os relatórios locais `informal-release-030.json`, `informal-release-030-final.json` e `acceptance-030-final.json` preservam os resultados intermediários; o sufixo “final” nesses arquivos não comprova equivalência com correções feitas depois. Compare seus hashes com os fontes atuais.

## Como ler os resultados

“Completo” exige decisão, regras e comportamento esperado, incluindo hipótese, pendência e retificação. Falha técnica não conta como acerto. Consulta pode citar uma regra classificatória sem classificar uma OS real; o corpus antigo tem uma divergência desse tipo, mantida no relatório em vez de alterar seu gabarito.

Os 1.024 cenários padronizados cobrem combinações explícitas de nove fatores em dois serviços, não todas as formas de escrever. Por isso apresento separadamente linguagem informal, negação, conversa e relatos complexos. As amostras são sintéticas e parte delas foi usada durante o desenvolvimento; não são taxa de acerto operacional nem teste cego universal.

Os relatórios JSON em `python/artifacts/` identificam versão, base, modelo, revisão Git e hashes dos fontes medidos. Esses arquivos são de teste sintético e não entram no pacote do analista. A medição separa inicialização, chamadas reais ao modelo e caminhos sem inferência. Não apresento a mediana dominada por casos fáceis como velocidade da IA.

## Limites e próximo passo

- Ainda não garanto interpretação correta de qualquer relato. Há frases elípticas que omitem se faltou imagem ou execução e precisam de esclarecimento.
- O protótipo interpreta texto; não inspeciona fotos, não gera linguagem livre como ChatGPT e não mede sozinho metragem real.
- As medições são da máquina de desenvolvimento, não do Latitude. CPU, memória e outros programas afetam a resposta.
- Atualização de regras pela interface e administração central continuam pendentes. Feedback é local e precisa ser exportado explicitamente.
- O aplicativo não tem assinatura própria; não modifiquei controles do Windows. Executar nesta máquina não garante liberação em outra.
- O próximo passo é reunir relatos reais anonimizados via feedback, revisar o gabarito com o responsável e ampliar os testes antes de expandir os serviços. Se as frases realmente usadas continuarem sem cobertura, é preciso reavaliar a estratégia semântica, não cadastrar conclusões por aproximação.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
