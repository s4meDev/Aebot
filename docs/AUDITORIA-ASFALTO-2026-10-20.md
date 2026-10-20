# Auditoria de Repavimentação Asfalto — 20/10/2026

## Conclusão

**O protótipo não está perfeito para todas as combinações e complexidades.** A aplicação das regras em frases padronizadas foi consistente e rápida. A interpretação de linguagem livre, negações, correções e escopos mistos ainda falhou. Encontrei inclusive duas conclusões oficiais indevidas, não apenas pedidos de esclarecimento.

Esta rodada é uma auditoria da versão publicada, não uma correção. Não alterei motor, regras, modelo, executável ou release. Acrescentei cenários sintéticos, um executor de auditoria e esta documentação.

## Versão, ambiente e método

- Código: commit `9daa5490b0549a6f58d6b4abce9b31dcecc4725c`; Python 0.1.1, base 2.16.0.
- Modelo real: BGE reranker ONNX quantizado, com a revisão e os hashes de `python/reranker.lock.json` verificados na carga. Não usei respostas simuladas.
- Máquina: Windows 11, Ryzen 5 5600G, 12 processadores lógicos e aproximadamente 7,87 GiB de RAM física. **Não é uma medição no Latitude.**
- 1.167 cenários, cada um repetido três vezes: **3.501 execuções de cenário e 3.552 mensagens avaliadas**. Uma conversa pode conter mais de uma mensagem.
- As avaliações de conteúdo ocorreram com o modelo carregado, sem outras suítes pesadas executadas intencionalmente em paralelo. Conexões de socket Python ficaram bloqueadas durante a carga e as avaliações.
- A latência da tabela mede a resposta final do cenário pela `Session`, incluindo motor e interpretação quando utilizada. Não inclui abrir o aplicativo, ler fotos ou o redesenho da janela Tkinter. Para conversas, o JSON também registra separadamente os tempos de todas as mensagens anteriores.
- Gabaritos definidos antes da execução, com base nas regras locais. Não ajustei o motor nem os resultados esperados para melhorar os números depois de observar as falhas.
- São cenários sintéticos e alguns são deliberadamente adversariais. **Não são uma amostra aleatória de OS reais nem uma homologação feita pelos analistas.** Os percentuais abaixo não estimam automaticamente a precisão em produção.

### O que considerei acerto

Conferi três dimensões:

1. **Decisão:** conclusão oficial correta, ou `null` quando não cabe concluir. Hipótese também precisa de conclusão condicional correta, sem classificar uma OS real.
2. **Fundamentação:** regras esperadas, serviço correto, referências existentes e citações rastreáveis. Em consultas, não basta devolver `null`; é necessário recuperar o assunto/regra pertinente.
3. **Comportamento:** continuação do caso, pergunta pendente e orientação operacional esperadas, quando previstas no cenário.

**Acerto completo** exige as três dimensões e nenhuma falha técnica, nas três repetições. Pedir esclarecimento quando já há base suficiente não conta como resolver o caso. Ausência de decisão por erro técnico também não conta como acerto.

## Resultado por tipo

Média, P95 e máximo abaixo são da resposta final, com o modelo já carregado. P95 significa que 95% das respostas medidas não ultrapassaram esse tempo.

| Tipo | Cenários | Decisão/cenário corretos | Acerto completo | Média | P95 | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Diretas padronizadas | 20 | 20/20 | 20/20 — 100% | 0,010 s | 0,020 s | 0,021 s |
| Duas falhas padronizadas | 72 | 72/72 | 72/72 — 100% | 0,016 s | 0,020 s | 0,027 s |
| Três a nove falhas padronizadas | 932 | 932/932 | 932/932 — 100% | 0,033 s | 0,048 s | 0,068 s |
| Corpus anterior | 53 | 50/53 | 50/53 — 94,3% | 0,300 s | 1,503 s | 2,567 s |
| Dezesseis perguntas adicionais anteriores | 16 | 16/16 | 14/16 — 87,5% | 0,831 s | 1,767 s | 1,990 s |
| Linguagem livre nova | 14 | 7/14 | 7/14 — 50,0% | 1,593 s | 3,282 s | 3,306 s |
| Negação, presença e hipótese | 14 | 10/14 | 9/14 — 64,3% | 1,174 s | 4,336 s | 4,474 s |
| Conversa e retificações | 13 | 8/13 | 5/13 — 38,5% | 1,280 s | 3,579 s | 3,843 s |
| Equipe, origem e adicional | 15 | 13/15 | 13/15 — 86,7% | 0,480 s | 2,472 s | 2,745 s |
| Relatos longos e escopos mistos | 12 | 4/12 | 2/12 — 16,7% | 2,980 s | 4,625 s | 4,754 s |
| Cobertura classificatória complementar | 6 | 6/6 | 6/6 — 100% | 0,013 s | 0,019 s | 0,019 s |

### Como interpretar esses números

- Testei todas as 1.022 combinações não vazias de **nove fatores selecionados**, nas duas faixas de Asfalto, com frases explícitas separadas por pontos. Os fatores foram antes, durante, depois, formulário, segurança, medição, acabamento, local e duplicidade. Isso **não equivale a todas as combinações de todas as regras em qualquer forma de linguagem**.
- Outros dois cenários conferiram aprovação explícita completa, e seis complementaram regras classificatórias restantes. As 27 regras classificatórias aplicáveis a esse serviço aparecem pelo menos uma vez nos gabaritos. Cobrir uma regra uma vez não esgota suas exceções e combinações.
- Nos **68 desafios da bateria ampliada** de linguagem, negação, conversa, contexto e relatos longos, houve **36 acertos completos: 52,9%**. Essa bateria inclui controles com frases já conhecidas, além de entradas novas; não são 68 perguntas inéditas ou um conjunto cego. O recorte é mais útil para examinar a fragilidade de interpretação do que misturá-lo às centenas de combinações fáceis.
- O total agregado foi 1.130/1.167 acertos completos, mas ele é dominado pelos casos padronizados. **Não o apresento como “96,8% de inteligência” ou de precisão em OS reais.**
- Em 25 cenários que comportavam uma decisão oficial, não houve conclusão. Em dois houve uma conclusão oficial indevida. Houve ainda falhas de conclusão condicional, fundamento ou continuidade. Não houve falha técnica nessas avaliações nem troca indevida de `serviceId`.
- Os resultados semânticos e verificações se mantiveram iguais nas três repetições. Repetir o mesmo resultado não significa que ele esteja correto.
- Nos 12 relatos longos, os oito cenários que exigiam uma decisão oficial ficaram sem conclusão. Os dois acertos completos eram orientações sem decisão oficial; não representam dois casos complexos classificados corretamente.

## Exemplos concretos de falha

| Entrada | Esperado pelas regras | Resultado observado |
| --- | --- | --- |
| “Não é verdade que faltou foto depois.” | Não aplicar ausência de foto; não classificar com base nessa frase. | **Reprovado**, nas três repetições. |
| “A medição não é incoerente.” | Não aplicar medição incoerente. | **Não Conforme**, nas três repetições. |
| “Sem aferição na OS de origem.” → “Manutenção” | Continuar a resposta pendente e aplicar a regra da origem fora de VCG. | Ficou sem decisão e não completou corretamente o contexto. |
| “Equipe terceirizada sem aferição...” → “Na verdade, a equipe era interna.” | Substituir a informação anterior e orientar Não Conforme com retrabalho. | Ficou sem conclusão e ainda citou a regra da equipe terceirizada. |
| Relato com aferição da origem presente e falta de aferição somente no serviço atual. | Diferenciar os escopos e aplicar a regra da equipe atual. | Pediu esclarecimento mesmo com fatos suficientes. |
| “O que significa duplicidade no Field?” | Explicar a regra de duplicidade sem afirmar que ela ocorreu. | Não emitiu decisão, mas também não recuperou a regra adequada. |

Os três casos pendentes do corpus antigo também permaneceram: trena descrita em orações diferentes, ausência de antes/durante em uma paráfrase e referência indireta à condição inicial.

O resultado anterior de 16/16 contava principalmente o campo de decisão. O critério mais forte desta auditoria identificou duas respostas sem fundamento pertinente, portanto **14/16 completos**, sem mudança do código. Não é uma regressão introduzida nesta rodada: é uma avaliação mais exigente.

## Diagnóstico técnico

1. **Negação e ocorrência:** `python/aebot/text.py` reconhece alguns padrões de negação, mas não representa seu alcance gramatical. Em `engine.py`, uma expressão conhecida pode confirmar a regra sem distinguir “faltou” de “não é verdade que faltou”. É possível errar rapidamente antes de usar o modelo.
2. **Retificação ainda não é um estado de fatos:** `session.py` concatena mensagens e depende de alternativas textuais para continuar a pendência. Não substitui de forma robusta uma equipe/frente antiga pela corrigida. Respostas curtas também não são resolvidas igualmente para todos os contextos.
3. **Relevância não comprova ocorrência:** o BGE compara assunto e relevância. O motor ainda depende de heurísticas de polaridade e limiares para aceitar o resultado. Isso não constitui compreensão conversacional equivalente a um modelo de chat.
4. **Cobertura do relato está desequilibrada:** certos trechos conhecidos são considerados totalmente cobertos; outros trechos explicativos ou corretos ficam pendentes e bloqueiam uma conclusão já sustentada. Simplesmente remover o bloqueio seria perigoso, pois poderia esconder outra falha relevante.
5. **Escopo:** fatos do serviço atual, da origem e do adicional precisam permanecer separados. Uma exceção ou evidência de um deles não deve cancelar ou criar irregularidade no outro.

Adicionar uma lista de sinônimos ou trocar a linguagem de programação, sozinho, não resolve essas falhas.

## Inicialização e aplicativo

O carregamento/verificação do motor nos avaliadores principal e de relatos longos levou 3,77 s e 3,41 s, respectivamente. Esse tempo não foi incluído nas respostas quentes da tabela.

Também executei três novas instâncias do EXE distribuído, **sem as outras suítes em paralelo**. O processo completo de `--check`, que valida Tk/modelo/base e realiza duas análises, levou 4,29 s, 3,25 s e 3,06 s; média **3,53 s**. Isso não é medição de abertura fria após reiniciar o PC: o cache de arquivos do Windows não foi limpo, e o diagnóstico inclui duas análises.

Uma execução diagnóstica anterior, em paralelo com verificações do legado, levou 11,95 s. Por isso não trato o tempo de inicialização como uma garantia universal de poucos segundos. No Latitude ainda é necessário medir abertura, primeira análise e respostas com outros aplicativos abertos.

## Outras validações

- 28 testes Python aprovados.
- 872 testes Vitest aprovados, um teste de capacidade pulado.
- Typecheck e build do legado aprovados.
- Teste da janela com modelo real aprovado: pergunta de equipe, resposta curta, Novo caso, segundo serviço e paráfrase.
- EXE distribuído executado com código de saída zero e inferência real no diagnóstico.

Esses testes verificam funcionamento e regressões conhecidas. Não anulam as falhas funcionais encontradas na auditoria nova.

## Próximo passo recomendado

Antes de afirmar que o protótipo está pronto para dúvidas complexas, preciso:

1. Corrigir a validação de ocorrência, negação, hipótese e citação antes de aplicar uma regra.
2. Manter fatos tipados por serviço/etapa/escopo, com fonte, estado e retificação explícita, em vez de depender só do texto concatenado.
3. Fazer as perguntas pendentes apontarem exatamente qual informação falta; resolver a resposta informal sem perder o restante do caso.
4. Diferenciar contexto já compreendido, trecho irrelevante e fato potencialmente decisivo ainda desconhecido, sem liberar conclusão parcial indevida.
5. Usar os erros novos como regressões e reservar outro conjunto operacional, revisado pelo responsável, sem ajustar o motor nele. Repetir a medição no Latitude.

**Minha avaliação atual: bom desempenho no caminho padronizado; ainda não confiável como um analista sênior autônomo em situações abertas. Não recomendo aceitar automaticamente as conclusões sem revisão.**

## Como repetir e onde estão os detalhes

Na raiz do projeto, com o ambiente/modelo já preparados:

```powershell
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite main --repeat 3 --output python/artifacts/minha-auditoria-main.json
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite complex --repeat 3 --output python/artifacts/minha-auditoria-complex.json
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite coverage --repeat 3 --output python/artifacts/minha-auditoria-coverage.json
```

Use destinos novos: o executor recusa sobrescrever relatórios. `status: completed` e exit code zero indicam que a medição terminou, **não que todos os cenários passaram**. Confira `strictPassed`, as divergências e os resultados individuais.

Fontes dos testes: `python/audits/asphalt_cases.py` e `python/audits/asphalt_complex_cases.py`. O executor é `python/audit_asphalt.py`. A medição isolada do EXE fica em `python/audits/executable_probe.py`.

Relatórios brutos desta rodada, locais e fora do Git:

- `python/artifacts/audit-asfalto-2026-10-20.json`
- `python/artifacts/audit-asfalto-longo-2026-10-20.json`
- `python/artifacts/audit-asfalto-cobertura-2026-10-20.json`
- `python/artifacts/exe-isolated-2026-10-20.json`

Eles contêm somente os cenários sintéticos usados no teste, não conversas de analistas. O modelo e os arquivos da release não foram substituídos nesta auditoria.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
