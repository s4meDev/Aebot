# Revisão do AEBOT Python — 20/10/2026

## Decisão sobre a versão

Vou continuar a rota **Python para o protótipo de Repavimentação Asfalto**. Ela atende melhor à necessidade de abrir em um notebook, trabalhar offline e responder rapidamente. Isso não significa que trocar a linguagem resolveu a interpretação: o BGE ainda é um modelo de relevância, não um ChatGPT local.

O Electron/TypeScript continua preservado. Ele tem mais recursos prontos, mas o modelo gerador usado nele foi lento nos testes anteriores. Não consegui repetir sua inferência nesta revisão: os pesos Qwen e o runtime antigo não estão nesta cópia restaurada. Portanto, não apresento uma comparação atual de assertividade entre os dois modelos.

| Ponto | Python 0.2.0 | Anterior: Electron/TypeScript |
| --- | --- | --- |
| Velocidade | Na rodada atual, chamadas reais ao modelo: média 0,58 s, mediana 0,34 s, máximo 1,46 s. | Registro histórico do 2.22.1: mediana 17,7 s e máximo 78,8 s com IA. Amostras e datas diferentes. |
| Modelo | BGE/ONNX relaciona trechos; a resposta vem das regras. Não gera raciocínio aberto. | Qwen3-4B/llama.cpp interpreta e gera orientação. Mais capacidade de geração não garante acerto. |
| Qualidade | Agora medi negação, correções e escopos separadamente. Ainda falha em linguagem informal. | Precisa ser reavaliado na mesma bateria antes de comparar inteligência ou afirmar que é melhor. |
| Conversa | Estado explícito de equipe, frente e escopo; correção substitui o valor antigo. | Fluxo maior, com histórico, interpretação, conferência e avaliação de fatos. |
| Recursos | Duas faixas de Asfalto, chat em memória, Novo caso. | Catálogo maior, interface React, feedback, métricas e importação de regras implementados. |
| Manutenção | Núcleo menor, dividido em texto, fatos, recuperação e decisão. Regras continuam no mesmo JSON. | Contratos TypeScript mais abrangentes e testes mais numerosos; arquitetura com mais componentes. |
| Uso offline e custo por chamada | Sim; sem API e sem cota de provedor. Depende de CPU e RAM. | Também é offline no perfil desktop, sem cota de API; o pacote inclui um modelo maior. |
| Distribuição | Pasta portátil com EXE, modelo e bibliotecas. Não precisa instalar Python. | Electron, runtime e GGUF; pacote maior e fluxo de distribuição já implementado. |
| Windows | EXE sem certificado próprio; pode ser bloqueado. | Mesma limitação do protótipo sem assinatura. Mudar linguagem não remove a política do Windows. |

**Resumo:** Python é a melhor base para o foco atual em Asfalto e velocidade. O anterior ganha em recursos de produto. Nenhum está comprovado para todas as perguntas ou para decisão automática sem revisão.

## O que corrigi

- Separei fatos de informações que mudam sua conclusão: equipe, frente e posição do serviço.
- Cadastrei esses contextos em `interpretation` e as dependências em `evaluation`, na base **2.17.0**. Não dupliquei conclusões no Python.
- Mantive origem, serviço atual e adicional executado separados. Aferição apresentada na origem não apaga a falta no serviço atual.
- Uma retificação de equipe ou frente substitui o dado anterior e preserva as outras falhas.
- A pergunta pendente tem dimensão e escopo tipados; uma resposta curta continua o caso, inclusive “não sei informar”.
- Bloqueei ocorrências explicitamente negadas e relatos incertos. Citação de exemplo não vira fato da OS.
- Removi combinações indevidas por palavras distantes, como interpretar “sem aferição na OS de origem” como “sem OS de origem”.
- Reutilizo a interpretação dentro do mesmo caso; Novo caso limpa esse cache. Não há gravação de conversa nem chamada de rede na análise.
- Mantive o legado compatível com os novos campos, com validação de referências e rejeição de campos desconhecidos.

## Testes com o modelo real

Máquina: Windows 11, Ryzen 5 5600G, 7,87 GiB de RAM, execução em CPU. Três repetições por cenário, sem outra suíte disputando o modelo. A rede foi bloqueada durante a análise. Os gabaritos existentes foram preservados; acrescentei 12 controles de conversa e segurança.

Na revisão dos controles novos, corrigi dois gabaritos que pressupunham o tipo de serviço do adicional sem ele ter sido informado. A regra exige esse dado. Mantive os relatos e passei a exigir esclarecimento, em vez de dispensar a condição no código. Portanto, esses controles novos não são apresentados como um teste cego do modelo; os gabaritos das baterias anteriores não foram alterados.

| Grupo | Python 0.1.1, auditoria anterior | Python revisado |
| --- | --- | --- |
| Combinações explícitas padronizadas | 1.024/1.024 | 1.024/1.024 |
| Corpus original | 50/53 completos | 49/53 completos; 50/53 decisões |
| Paráfrases anteriores | 14/16 completos | 16/16 |
| Linguagem informal nova | 7/14 | 7/14 |
| Negação, presença e hipótese | 9/14 | 14/14 |
| Conversa e retificações | 5/13 | 13/13 |
| Equipe, origem e adicional | 13/15 | 15/15 |
| Relatos longos, com escopos mistos | 2/12 | 12/12 |
| Cobertura classificatória adicional | 6/6 | 6/6 |
| Controles novos | Não existiam | 12/12 |

Na mesma bateria ampliada de **68 desafios**, passei de **36 para 61 acertos completos**. No total novo, foram **1.168/1.179 cenários completos**, repetidos três vezes: 3.537 execuções e 3.600 mensagens. Não uso a porcentagem geral como assertividade operacional: a maioria são combinações padronizadas, mais fáceis do que relatos reais.

Não houve falha técnica nem conclusão oficial errada nesta rodada. Houve **10 abstenções onde o gabarito previa uma conclusão**, além de uma divergência de recuperação informativa. Isso não prova ausência de falsos positivos fora desta amostra.

### Tempos, com o modelo já carregado

- Chamadas reais ao BGE: 105 mensagens; média **584 ms**, mediana **339 ms**, p95 **1.269 ms**, máximo **1.463 ms**.
- Sem chamada ao modelo: 3.495 mensagens; média **4,55 ms**, máximo **45,35 ms**.
- Relatos longos: média da resposta final **178 ms**, máximo **1.179 ms**. Parte deles foi resolvida sem inferência.
- Inicialização do motor nessa rodada: **1,96 s**. Não é medição de boot frio do Windows.

Os tempos não são SLA para o Latitude. Mantive as três repetições com a interpretação limpa entre casos independentes; só há reaproveitamento dentro da própria conversa.

## Divergências que continuam abertas

Ainda não interpreto com segurança certas descrições de trena impeditiva, falta de foto inicial/durante em paráfrase, acabamento desnivelado, execução em outra rua, lançamento esquecido e troca disponível. Nesses casos, peço esclarecimento e não emito a decisão esperada. A linguagem informal nova ficou em **7/14**, sem melhora nessa subamostra: é a principal limitação do modelo atual.

O corpus original caiu um ponto na verificação completa porque uma consulta sobre duplicidade agora recupera a regra classificatória **para explicá-la**, mantendo `decision: null`. O gabarito anterior esperava nenhuma regra classificatória recuperada. Registrei essa diferença; não alterei o gabarito para fazê-la desaparecer.

Não há leitura de fotos, histórico persistente, feedback ou importador de regras nesta rota. O uso em máquinas limpas e o tempo no Latitude precisam de medição própria. O protótipo continua sem assinatura digital própria.

## Reprodução e arquivos

```powershell
$env:PYTHONPATH = 'python'
.\.venv\Scripts\python.exe -m unittest discover -s python/tests -v
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite full --repeat 3 --output python/artifacts/nova-rodada.json
.\.venv\Scripts\python.exe python/test_app.py
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

`nova-rodada.json` precisa ser um nome ainda não usado. Os relatórios locais ficam fora do Git e contêm somente os exemplos sintéticos dos testes. A rodada de entrega está em `python/artifacts/improvement-release-2026-10-20.json`; a anterior, antes de preservar condições adicionais, continua em `improvement-final-2026-10-20.json`. O campo `commit` registra a base Git 9daa549; as alterações foram testadas no workspace, não naquele commit isolado.

O pacote local novo é `python/dist/AEBOT-Python-0.2.0.zip`. A publicação GitHub 0.1.1 permanece como versão anterior; não a substituí silenciosamente. O guia de transferência explica a diferença.

### Validação da entrega

- Python: **40 testes de unidade aprovados**.
- Legado: **875 testes Vitest aprovados**, um teste de capacidade ignorado pela configuração normal; typecheck e build aprovados.
- Janela Tkinter: modelo real, resposta à pergunta pendente, Novo caso, segundo serviço e paráfrase aprovados.
- EXE 0.2.0: **três execuções de diagnóstico aprovadas**, confirmando base 2.17.0 e inferência real. Tempos do processo inteiro: 5,90 s, 3,26 s e 3,26 s; média **4,14 s**, incluindo abertura, verificação e encerramento. Não trato esse número como tempo isolado de resposta ou melhoria de abertura sobre a versão anterior.
- Pacote: manifesto SHA-256 conferido; ZIP completo gerado com verificação CRC, aproximadamente **472 MiB**. Guia e resultados acompanham a pasta. Não há conversa nem credencial incluída.

O diagnóstico está em `python/artifacts/exe-020-release-check.json`. O relatório dentro do ZIP foi copiado na geração, antes dessa medição final do EXE; esta seção registra a conferência posterior.

## Próximo passo

Priorizar os 10 relatos ainda não concluídos e reunir uma amostra operacional anonimizada, com gabarito revisado pelo responsável. Usá-la para comparar outra estratégia de interpretação local, sem trocar velocidade por decisões sem suporte. Depois medir abertura, memória e latência no Latitude e só então ampliar os serviços e recuperar feedback/importação do legado.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
