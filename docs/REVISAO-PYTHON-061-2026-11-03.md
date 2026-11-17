# Otimização da conversa — Python 0.6.1

03/11/2026 · Regras preservadas na base 2.20.0 · Repavimentação Asfalto

## O que corrigi

Uma consulta com “E qual é a regra…” podia reutilizar os fatos anteriores e responder sobre o assunto errado. Agora consulto a mensagem atual, mantenho a citação literal e preservo o estado do caso. Também evito repetir inferência de um relato semântico só para responder uma consulta lexical simples.

Uma hipótese pendente tinha o mesmo problema: qualquer mensagem seguinte podia virar resposta da simulação. A hipótese agora mantém sua própria última avaliação. Posso interromper para consultar outra regra e depois responder “interna”, por exemplo. Essa consulta não escolhe equipe nem vira fato do caso real. “Voltando ao caso real: …” permite encerrar a simulação e retomar a OS sem herdar fatos hipotéticos.

Trocar de serviço e Novo caso descartam as pendências anteriores. No mesmo caso, consultas preservam os caches limitados em RAM; fora dele, a limpeza permanece obrigatória. A resposta à pendência não tem limite artificial de palavras: pode trazer o contexto e outra falha, ainda sujeita ao motor completo.

Na interface, diferenciei consulta, hipótese e relato independente. Uma consulta não aparece como “novo caso” nem esconde que há esclarecimento pendente. Ao enviar uma nova análise, descarto o resultado anterior do botão **Ver fundamentos**: se houver falha, ele não fica mostrando uma justificativa antiga para a tentativa nova. A resposta anterior permanece no chat em memória. A recuperação de preparação também mantém os controles visíveis na janela mínima.

## Organização do código

- `session.py`: separa consulta intermediária, resposta pendente, hipótese e retomada real; `Scenario.last` mantém a devolutiva da própria hipótese.
- `text.py`: reconhece conectivos em consultas e marcadores de retomada, sem regras de um serviço.
- `app.py`: apresenta os estados, avisa da pendência preservada e não reutiliza fundamentos após falha.
- `tests/test_conversation_routing.py`: regressões rápidas de contexto, serviço e cache.
- `audits/conversation_cases.py`: cenários sintéticos com modelo real, nas duas faixas.
- `benchmark_conversation.py`: compara a mesma consulta intermediária antes/depois, com versão e hashes. Não coleta uso real nem faz parte do chat.

Não alterei modelo, limiar de aceitação, regras ou gabaritos anteriores nesta rodada. A fonte continua `src/data/rulesStore.json`; comentários e guias não são outra base de decisões.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Unittest Python | 128 aprovados. Os 11 novos testes de roteamento reproduziram seis falhas antes da correção e passaram depois. |
| Vitest do legado | 878 aprovados, um ignorado. A tentativa restrita falhou por EPERM no cache, antes de executar testes; a repetição autorizada fora do sandbox passou, sem alterar proteções do Windows. |
| Typecheck / build | Aprovados. |
| Janela com modelo real | Aprovada: tamanhos, esclarecimento, consulta no meio de hipótese, retomada por resposta curta, fundamentos desativados após falha, feedback separado e recuperação de preparação em 580 × 500. |
| Auditoria completa | 1.336/1.338 no critério completo; 1.337/1.338 decisões esperadas. Nenhuma conclusão oficial indevida nem falha técnica na amostra. |
| Isolamento de conversa novo | 18/18 cenários nas duas faixas. |
| Cobertura da base | 39/39 regras/orientações; nenhuma classificatória sem relato factual sintético. |
| Corpus anterior independente | 52/53 completos, 53 decisões esperadas; preservada a divergência da citação em consulta. |
| Semânticos adicionais | 16/16 com modelo real, rede bloqueada no teste e conferência de independência dos pares. |
| EXE 0.6.1 | Três diagnósticos aprovados com modelo real, interface, consulta intermediária, retomada da hipótese e feedback sintético em SQLite temporário. |

O relatório principal é `python/artifacts/full-061-release-2026-11-03.json`, com hashes da fonte. As duas divergências anteriores permanecem contabilizadas: a consulta de duplicidade cita uma regra classificatória como consulta, enquanto o gabarito espera nenhuma; o relato “tem o começo e o pronto, só não tem o pessoal fazendo o serviço” pede esclarecimento, enquanto o gabarito antigo espera Não Conforme. Não removi esses casos nem alterei seus gabaritos.

### Ganho específico nas consultas intermediárias

Medi as mesmas duas sequências, nas duas faixas, com três repetições por sequência/faixa: 12 consultas em cada versão. O relato inicial continua passando pelo motor completo. A consulta atual precisa recuperar a regra certa, não emitir decisão e citar somente a própria pergunta.

| Medida | 0.6.0 | 0.6.1 |
| --- | --- | --- |
| Consultas aprovadas com assunto e fonte corretos | 0/12 | 12/12 |
| Média de consulta depois de um relato semântico | 718,87 ms | 1,08 ms |
| Chamadas repetidas ao modelo nesses turnos de consulta | 6 | 0 |

Os relatórios são `conversation-baseline-060-2026-11-03.json` e `conversation-optimized-061-2026-11-03.json`. Esse ganho vem de não reanalisar o relato anterior com intenção errada, não de deixar o BGE centenas de vezes mais rápido. A medição em milissegundos é interna; o desenho da interface ainda depende da fila e do computador. Não apresento esse recorte como velocidade ou acerto de toda análise complexa.

### Tempos gerais e limite observado

Na auditoria, 101 mensagens com chamada real à IA tiveram média de 1,44 s, mediana de 1,32 s e P95 de 2,72 s. **O maior tempo foi 8,56 s**, num relato negativo de duplicidade com duas comparações semânticas. Esse pico permanece registrado; não posso anunciar que toda pergunta termina em poucos segundos. Nessa rodada também houve execução de validações do legado; isso não comprova sozinho a causa do pico.

As 1.320 mensagens sem nova chamada ao modelo tiveram média de 11,22 ms, P95 de 31,57 ms e máximo de 80,50 ms. Conferir/carregar o motor levou 2,24 s, separado das respostas. São dados desta máquina Windows 11 com aproximadamente 8 GB de RAM e 12 processadores lógicos, não uma certificação do Latitude. Muitas combinações são explícitas; não uso sua média rápida como se fosse exclusivamente o desempenho da IA.

Repeti o relato do pico isoladamente **na mesma faixa acima de 1 m²**, com a mesma pergunta e serviço extraídos da auditoria: 2,67 s, 2,66 s e 2,72 s, sempre sem decisão indevida e com duas comparações. O relatório é `duplicate-negative-same-service-061-2026-11-03.json`. A conferência inicial na faixa até 1 m² ficou em outro artefato, mas não serve como comparação desse pico porque a identidade do serviço participa da entrada do modelo. Não substituí o máximo de 8,56 s da auditoria por esse teste isolado nem alterei runtime/modelo para anunciar melhora inexistente.

## Entrega

Gerei uma pasta portátil nova, preservando a 0.6.0. O diagnóstico do EXE levou 3,91 s, 3,57 s e 3,61 s contando abertura e verificações. A paráfrase isolada desse smoke test levou 0,72 s, 0,88 s e 0,89 s; esse exemplo simples não substitui os tempos gerais da auditoria. Os diagnósticos foram executados fora da restrição do sandbox para permitir o banco temporário de teste, sem acessar feedback real nem mudar proteções do Windows.

Conferi que o catálogo empacotado é idêntico à projeção validada da fonte e que os hashes dos arquivos auditados continuam iguais. Atualizei somente os guias depois do teste do EXE e regenerei o manifesto antes do ZIP. O pacote leva aplicativo, runtime, modelo, regras, diagrama e `00-COMECE-AQUI.txt`; não inclui banco local, credenciais, conversas ou artefatos de auditoria. A compactação confere SHA-256 dos arquivos e CRC do ZIP.

O próximo foco é ampliar a regressão com relatos informais voluntários, revisar ambiguidades reais de evidência versus execução e medir os picos no notebook de uso, sem prometer ausência de erro. Esta rodada corrige conversas e evita trabalho redundante; não anuncia que todo caso complexo ficou instantâneo.

## Limitações mantidas

O BGE relaciona linguagem às regras; não é um modelo gerador equivalente ao ChatGPT. Os limites de interpretação da 0.6.0 continuam sendo medidos, sem ajustar o gabarito para escondê-los. Conversas e caches ficam somente em memória; SQLite recebe apenas feedback voluntário e versões, sem anexar chat ou métricas.

O pacote portátil continua sem certificado próprio do AEBOT. Não altero controles do Windows para executar. A validação operacional com relatos reais e a conferência das respostas pelo responsável continuam necessárias.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
