# Segurança da interpretação — Python 0.6.2

04/11/2026 · Base 2.20.0 preservada · Repavimentação Asfalto

## O que corrigi

Ampliei os testes para frases informais que a suíte anterior não cobria. Encontrei reprovações indevidas em “não está sem foto depois”, “não ficaram sem foto depois” e “não faltam fotos depois”. Agora a negação da falta não é tratada como ausência. A correção desse ponto mantém outras falhas independentes, sem aprovar a OS por padrão.

Também corrigi “interna ou terceirizada” e “interna/terceirizada”: nenhuma dessas frases confirma a última equipe citada. O contexto fica explicitamente desconhecido e a pergunta é mantida. Se antes havia uma equipe confirmada, uma retificação ambígua suspende esse valor no mesmo escopo até o esclarecimento. Não escolho o resultado mais grave só por haver uma alternativa no texto.

Negar uma equipe (“não é uma equipe própria”, “nem é terceirizada”) não confirma esse vínculo. Se essa equipe estava confirmada antes, a retificação suspende esse valor até um novo esclarecimento, sem presumir o oposto. Já “não é interna, é terceirizada” contém uma afirmação posterior válida. O matching flexível deixou de reinserir uma expressão exata já descartada por negação.

Depois de conferir os fatos lexicais, uma resposta formada só por contexto não disputa um defeito no BGE. Isso evita que “nem interna” seja mantido como uma suposta evidência ausente e bloqueie o esclarecimento posterior. A checagem usa os valores e escopos cadastrados; não há limite artificial de palavras nem descarte de outra falha trazida junto na resposta.

“Não só faltou…” é ênfase, não negação. A coordenação “não só faltou foto antes como também foto depois” preserva as duas ausências e seus trechos literais. A retomada do substantivo exige uma etapa cadastrada; não transformo “sinalização” numa foto. Os nomes de registro, inclusive vídeo, vêm de `interpretation.recordTerms`, não de outra lista no código.

Quando um ponto reconhecido não confirma uma falha, respondo isso de forma curta, sem inventar aprovação nem dizer automaticamente que falta regra. Em **Ver fundamentos**, os trechos não confirmatórios aparecem separados das regras realmente aplicadas. Nenhuma observação inativa entra na combinação de faltas.

## Como organizei

- `text.py`: negação de falta, contexto negado, coordenação e palavra literal de registro.
- `store.py`: entrega ao normalizador os termos de registro da fonte única.
- `facts.py`: distingue contexto confirmado de alternativa ainda desconhecida; a incerteza não reutiliza o valor antigo.
- `extraction.py`: evita interpretar contexto puro como nova irregularidade, depois de conferir os matches lexicais.
- `contracts.py`: `ContextFact.value` aceita `null` para contexto explicitamente não confirmado. Isso não é uma conclusão oficial nova.
- `engine.py`: reconhece um ponto não confirmatório sem fechar a OS.
- `evidence_ui.py`: mostra o trecho descartado sem apresentá-lo como regra aplicável.
- `tests/test_language_safety.py` e `audits/language_safety_cases.py`: novas regressões de presença, ausência, contexto e combinações nas duas faixas.

Não alterei o catálogo de regras, suas conclusões, o modelo ou seus limiares. Não ajustei gabaritos anteriores. Os resultados antigos continuam válidos apenas para as amostras que realmente cobriam; novos relatos revelaram falhas antes não exercitadas.

## Validação

Os 144 testes Python passaram, incluindo 16 métodos novos de segurança linguística com controles e subcasos. Antes da primeira correção, os dez métodos iniciais produziram 17 subcasos falhos. Ampliei depois os controles de contexto, retomada e afirmação negada. Os gabaritos anteriores não foram alterados.

Os 878 testes do legado passaram, com um ignorado, na execução autorizada fora do sandbox devido à restrição conhecida do cache temporário. Não alterei proteções do Windows. A janela passou com modelo real, incluindo equipe alternativa → pergunta → “interna”, reconhecimento de negação de falta e leitura dos trechos não confirmatórios, além dos fluxos anteriores e tamanhos de janela.

O relatório final de auditoria é `python/artifacts/full-062-final-2026-11-04.json`. A rodada `full-062-release-2026-11-04.json` é intermediária: antecede a otimização de contexto puro e os cenários de negativa do vínculo antigo. Teste sintético não é garantia de 100% em linguagem livre. Não conto falha técnica ou simples abstenção como acerto completo.

| Conferência final | Resultado |
| --- | --- |
| Auditoria completa | 1.392/1.394 no critério completo; 1.393/1.394 decisões esperadas. |
| Segurança linguística nova | 56/56 cenários nas duas faixas; também confere perguntas e fundamentos. |
| Conclusão oficial indevida / falha técnica | Nenhuma nessa amostra. |
| Cobertura | 39/39 regras/orientações; nenhuma classificatória sem relato factual sintético. |
| Fonte medida | Hashes do relatório coincidem com os arquivos da entrega. |
| Corpus independente | 52/53 no critério completo; 53/53 decisões. Permanece a divergência de fundamento na consulta de duplicidade. |
| Cenários semânticos adicionais | 16/16; acesso à rede bloqueado no teste e independência dos pares conferida. |
| Typecheck / build do legado | Ambos passaram. |
| Executável portátil | Três diagnósticos completos passaram, incluindo interface, modelo real e feedback temporário. |

As duas divergências anteriores continuam registradas: a consulta de duplicidade cita uma regra classificatória como consulta, enquanto o gabarito espera nenhuma; o relato “tem o começo e o pronto, só não tem o pessoal fazendo o serviço” pede esclarecimento, enquanto o gabarito antigo espera Não Conforme. Não removi esses casos nem os transformei em acertos por ajuste de gabarito.

### Tempos desta rodada

| Caminho | Mensagens | Média | P95 | Máximo |
| --- | --- | --- | --- | --- |
| Com chamada real ao modelo | 101 | 1,34 s | 2,45 s | 2,99 s |
| Sem nova chamada ao modelo | 1.394 | 9,28 ms | 15,19 ms | 28,15 ms |

Conferir/carregar o motor levou 3,35 s, separado da resposta. Na categoria nova, as 74 mensagens dos 56 cenários levaram média de 5,09 ms e máximo de 7,95 ms; são frases resolvidas pela leitura gramatical/contextual, não uma medida de inferência neural. Uma mesma conversa pode ter vários turnos, por isso há mais mensagens que cenários.

O hardware desta medição foi Windows 11, Python 3.12.14, aproximadamente 8 GB de RAM física e 12 processadores lógicos. Isso não homologa o Latitude nem elimina picos em outras cargas. O pico de 8,56 s registrado na 0.6.1 permanece histórico; não anunciei que ele se tornou impossível.

No corpus independente, o máximo foi 3,98 s, com mediana de 5,36 ms; essa mistura de caminhos não representa o tempo típico da inferência neural. Nos 16 cenários semânticos adicionais, o máximo foi 2,46 s. Os três diagnósticos do EXE levaram entre 4,28 e 4,46 s para iniciar e concluir todas as verificações; a chamada semântica isolada levou entre 0,72 e 0,90 s. Esses números são testes sintéticos desta máquina, não telemetria nem promessa de tempo em qualquer notebook.

## Entrega portátil

A pasta `python/dist/AEBOT-Python-0.6.2` e seu ZIP contêm executável, modelo, dependências, regras projetadas, licenças e instruções. O analista não instala Python, não configura chave e não precisa iniciar servidor. Deve extrair a pasta inteira e abrir `00-COMECE-AQUI.txt` antes do `AEBOT.exe`; mover somente o executável não funciona.

O empacotador confere os hashes dos arquivos e a lista completa antes de gerar o ZIP, e confere o CRC depois. Os resultados deste documento acompanham o pacote como `RESULTADOS-TESTES.md`. Os diagnósticos do executável ficam em `python/artifacts/exe-062-check-2026-11-04-1.json` e nas repetições 2 e 3, fora da pasta distribuída. Não incluo perfil, credenciais, conversas nem banco de feedback nessa entrega.

## Limites mantidos

O BGE relaciona linguagem às regras; não é um modelo gerador equivalente ao ChatGPT. Nenhuma suíte finita demonstra todas as combinações possíveis. Casos ambíguos ainda precisam de pergunta, e a orientação precisa ser conferida na OS. O aplicativo não lê fotos.

Continuo offline, sem chave, telemetria ou conversa em disco. Somente feedback voluntário é salvo, sem anexar chat ou tempos. O pacote não possui certificado próprio do AEBOT nem altera controles do Windows. As entregas anteriores são preservadas.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
