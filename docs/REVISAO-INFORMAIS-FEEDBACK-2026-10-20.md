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
- Antes de empacotar, a auditoria detectou que a retomada de substantivo estava ampla demais e confundia “sem sinalização” com uma foto citada antes. Corrigi: só complemento de contexto por oração cadastrado pode retomar o substantivo. Acrescentei a regressão e todas as 1.024 combinações explícitas aos testes sem modelo. A rodada `package-030-full.json` foi interrompida após encontrar esse defeito; não é o resultado da entrega.
- Cache é limitado à memória do caso e considera texto original, contexto, serviço, base e candidatos. Novo caso, inclusive escrito no chat, limpa as interpretações anteriores.

As conclusões e orientações continuam no `rulesStore.json`. Não copiei regras para Python, não alterei as três conclusões oficiais nem baixei outro modelo para a entrega. BGE mede relevância: não é um LLM conversacional nem uma prova formal de que um fato ocorreu. Se a associação não for suficiente, peço esclarecimento ou mantenho a análise sem decisão.

## Feedback, sem métricas

Implementei formulário voluntário, leitura/busca local e exportação/importação JSON. O responsável pediu **somente feedback** nesta etapa: não há métricas persistentes nem gravação automática do chat.

O formulário começa vazio. Salvo descrição, orientação esperada opcional, categoria, serviço, data, ID e versões. O banco fica no perfil Windows, fora da pasta do aplicativo. Importações inválidas ou conflitantes são recusadas inteiramente; reenviar o mesmo registro não duplica. Feedback não altera regra ou modelo automaticamente. Veja `docs/FEEDBACK-PYTHON.md` ou `GUIA-FEEDBACK.md` no pacote.

## Validação desta entrega

O checkpoint anterior foi salvo no commit `8273637`. Depois dele corrigi a regressão de elipse e repeti a medição, em série, sem outro modelo ou suíte pesada concorrente.

| Verificação | Resultado |
| --- | --- |
| Python, incluindo manifesto e guia portátil | 70 testes aprovados; um deles verifica as 1.024 combinações explícitas |
| Auditoria principal, 1.230 cenários × 3 | 1.228 completos; 1.229 decisões/cenários esperados; zero conclusão oficial incorreta e zero falha técnica |
| Amostra adicional, 20 cenários × 3 | 20 completos; zero falha técnica |
| Janela com modelo real | Aprovada: equipe, resposta curta, serviço selecionado, Novo caso e feedback sem anexar chat |
| Diagnóstico pelo código | Aprovado: modelo, base, Tk, análise lexical, análise neural e feedback sintético em SQLite temporário |
| Legado | 875 testes aprovados, um ignorado; typecheck, build e Manifest V3 aprovados |
| Integridade da base | 36 serviços, 100 regras, sem aviso de governança |

As duas divergências da auditoria principal foram preservadas:

1. “tem o começo e o pronto, só não tem o pessoal fazendo o serviço”: esperado Não Conforme; o sistema pede esclarecimento e fica sem decisão. É uma limitação na referência implícita à evidência, não um acerto.
2. Consulta sobre duplicidade: a resposta mantém `decision: null` e cita a regra consultada, mas o corpus antigo esperava nenhuma regra classificatória citada. Conta como divergência de fundamento, não como OS reprovada.

Recortes: as 1.024 combinações explícitas passaram; corpus anterior 52/53 completos (53/53 decisões/cenários); 16 paráfrases anteriores passaram; 14 relatos de linguagem livre passaram; 29 novos informais tiveram 28 completos; os 12 relatos longos e os oito novos complexos passaram. Não alterei gabaritos para esconder as falhas.

Medições da auditoria principal nesta máquina (Ryzen 5600G, 12 processadores lógicos, 7,87 GiB de RAM, Windows 11, Python 3.12.14):

| Caminho medido | Média | Mediana | P95 | Máximo |
| --- | --- | --- | --- | --- |
| 225 mensagens com chamadas reais ao BGE, modelo já carregado | 2,10 s | 1,82 s | 3,98 s | 5,13 s |
| 3.534 mensagens sem chamada ao modelo | 6,48 ms | 6,08 ms | 11,07 ms | 103,63 ms |

Inicializar e conferir o motor levou 3,06 s. Nos 12 relatos longos, a média por mensagem foi 1,68 s e o máximo 4,25 s. São medidas desta rodada/máquina, não garantia de tempo no Latitude nem para qualquer pergunta. Respostas com vários trechos podem exigir mais de uma comparação.

Relatórios finais desta medição: `package-030-corrected-full.json`, `package-030-corrected-acceptance.json` e `package-030-corrected-runtime.json`, em `python/artifacts/`. Os hashes do motor, base e cenários identificam o código efetivamente avaliado. O diagnóstico do EXE e os guias de empacotamento foram ampliados à parte, sem alterar essa inferência, e precisam passar no pacote gerado.

As rodadas `informal-release-030*.json`, `acceptance-030-final.json` e a rodada interrompida `package-030-full.json` são históricas. O sufixo “final” de um nome antigo não comprova equivalência com as correções posteriores.

**Executável 0.3.0 gerado e aprovado em três novas instâncias**, todas com exit code zero e feedback conferido. Tempos do processo completo `--check`: 12,06 s, 5,35 s e 5,06 s. Cada medição inclui abrir o processo, conferir hashes, carregar o modelo, fazer duas análises, testar o feedback e encerrar. Não é tempo de uma resposta nem boot frio do Windows. A análise neural nessas instâncias levou 2,32 s, 1,28 s e 1,29 s. Relatório local: `package-030-exe.json`.

O ZIP leva EXE, runtime, modelo, regras, guias e licenças. Antes de compactar, o script confere hashes e arquivos extras; depois verifica o CRC. O ponto de partida para o usuário é `00-COMECE-AQUI.txt`. Não contém banco de feedback, conversas, credenciais ou os modelos experimentais rejeitados. O pacote continua sem assinatura própria e sem garantia de acerto universal.

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
