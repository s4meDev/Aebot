# Revisão do aplicativo Python 0.6.0

03/11/2026 · Base preservada em 2.20.0 · Duas faixas de Repavimentação Asfalto

## O que melhorei

Separei o assunto do pedido de explicação na recuperação semântica. Por exemplo, o modelo compara o assunto literal depois de “quero entender”, mantendo a negação, a citação original e a intenção de consulta. Não baixei o limiar do modelo nem acrescentei critérios de negócio.

Quando o relato de uma etapa não deixa claro se falta registro ou se a atividade não aconteceu, a devolutiva pergunta essa diferença. A resposta “quis dizer…” continua substituindo somente o trecho ambíguo. Não resolvi essa ambiguidade fabricando uma foto ausente.

Separei a apresentação da avaliação. O chat mostra uma versão curta; **Ver fundamentos** reúne a resposta completa, todas as regras, os trechos e as ações. Hipótese e consulta são identificadas como tal. Uma orientação secundária não pode mandar aprovar uma OS cuja conclusão final é Reprovado. Nenhuma regra é descartada do resultado estruturado para encurtar a tela.

A interface branca/azul mantém a marca Aegea, melhora a hierarquia da conversa e mostra progresso somente enquanto trabalha, além do estado da última resposta. **Novo caso** limpa também esse estado visual e fecha os fundamentos antigos. Tab permite sair do campo de mensagem. Se a preparação falhar, posso tentar novamente sem fechar tudo. A interface não aceita um motor carregado com outra base.

Pedidos educados como “pode me explicar…” são consultas mesmo sem o ponto de interrogação. Isso não é um relato de irregularidade nem precisa gerar a pergunta de equipe de uma OS concreta.

Os caches de normalização e tokens passaram a pertencer à instância, com limpeza no início de outro caso e em Novo caso. Os caches de interpretação e pares continuam limitados em RAM. Não criei banco de conversas, telemetria nem envio online; feedback continua voluntário, separado do chat.

## Como mantenho o código

- `python/aebot/engine.py`: avalia fatos e condições; não desenha a interface.
- `python/aebot/response.py`: organiza mensagens sem escolher a decisão.
- `python/aebot/evidence_ui.py`: mostra fundamentos em memória, sem persistência.
- `python/aebot/app.py` e `theme.py`: estados e identidade da interface.
- `python/aebot/text.py` e `session.py`: texto, continuidade e limpeza do caso.
- `python/tests/test_response.py`: contratos de apresentação, privacidade e consulta.
- `python/audits/response_cases.py`: novas consultas e esclarecimentos com modelo real.

Regras de negócio continuam apenas em `src/data/rulesStore.json`. Não alterei a base nem o gabarito antigo nesta rodada. Os critérios de trena confirmados pelo responsável permanecem válidos.

## Validação

Os relatórios medem casos sintéticos e identificam os hashes reais dos arquivos, não conversas dos analistas. Não considero falha técnica, simples abstenção ou só o rótulo da decisão como acerto completo.

| Verificação | Resultado |
| --- | --- |
| Unittest Python | 117 aprovados. |
| Vitest do legado | 878 aprovados, um ignorado. |
| Typecheck / build do legado | Aprovados. |
| Janela com modelo real | Aprovada em 580 × 500, 1.024 × 650 e 1.280 × 720; fundamentos completos, Novo caso, resposta curta de equipe e recuperação de falha de preparação. |
| Auditoria completa com modelo real | 1.318/1.320 no critério completo; 1.319/1.320 decisões esperadas. |
| Cenários novos de resposta/fundamentos | 18/18, nas duas faixas. |
| Matriz de trena por equipe | 24/24, preservada. |
| Cobertura do catálogo | 39/39 regras/orientações em algum cenário; nenhuma classificatória sem relato factual sintético. |
| Corpus independente anterior | 52/53 completos, 53 decisões esperadas; mesma divergência de citação na consulta de duplicidade. |
| Semânticos adicionais | 16/16 com modelo real e rede bloqueada no teste; conferida também a independência dos pares. |
| EXE gerado | Três diagnósticos aprovados com base 2.20.0, modelo real, interface/fundamentos e feedback sintético em banco temporário. |

Na auditoria final não houve decisão oficial indevida nem falha técnica nessa amostra. Os hashes do relatório `python/artifacts/full-060-release-2026-11-03.json` coincidem com os arquivos medidos. As rodadas `review` e `final` anteriores são intermediárias; a referência desta entrega é a rodada `release`.

As quatro divergências anteriores caíram para duas, sem mudar seus gabaritos:

1. A consulta de duplicidade ainda cita uma regra classificatória como **consulta**, sem declarar ocorrência ou concluir a OS. O gabarito antigo espera nenhuma regra classificatória citada; mantenho essa divergência de fundamento contabilizada.
2. “Tem o começo e o pronto, só não tem o pessoal fazendo o serviço” ainda resulta em esclarecimento, enquanto o gabarito antigo espera Não Conforme. Agora pergunto se falta o registro ou se a atividade não aconteceu. Com “quis dizer: sem foto durante”, a orientação esperada é produzida. Não contei a abstenção inicial como acerto.

As duas consultas “quero entender o desfecho que ninguém deixou ver” agora recuperam a regra de resultado final como consulta, mantendo decisão oficial nula. O novo cenário de pedido educado sem interrogação também passou.

### Tempos medidos

No Windows 11 desta máquina, com 7,87 GiB de RAM física e 12 processadores lógicos:

| Caminho | Amostra de mensagens | Média | P95 | Maior tempo |
| --- | --- | --- | --- | --- |
| Com chamada real ao BGE | 101 | 1,46 s | 2,76 s | 3,33 s |
| Sem nova chamada ao modelo | 1.272 | 9,87 ms | 15,40 ms | 46,99 ms |

Conferir/carregar o motor levou 3,31 s, separado da resposta. A auditoria inclui muitos casos combinatórios explícitos: não apresento a média geral como velocidade exclusiva da IA. Os turnos de conversa explicam haver mais mensagens que cenários. Não comparei notebooks diferentes nem homologuei o Latitude nesta rodada.

No EXE, abertura mais o diagnóstico completo levou 4,20 s, 3,83 s e 3,88 s. A paráfrase usada nesse smoke test levou 0,81 s, 1,01 s e 1,02 s; não substituo a distribuição de tempos da auditoria por esse único exemplo mais simples. O diagnóstico conferiu a nova tela de fundamentos, a ausência de progresso em repouso e a limpeza de Novo caso. A execução dos diagnósticos fora da restrição do sandbox não alterou controles do Windows nem acessou feedback real.

Conferi a janela visualmente com a skill de uso do computador; essa conferência levou à correção da barra que parecia ativa em repouso. Os testes automatizados da própria janela conferiram conversas, três tamanhos, fundamentos, feedback separado e recuperação de preparação. A ferramenta nativa não expõe campos Tk como elementos de acessibilidade completos; a entrada de texto foi validada pelo teste da aplicação, não anunciada como homologação de acessibilidade.

O pacote usa a projeção validada da fonte única e preserva os modelos e entregas anteriores. O ZIP leva manifesto SHA-256 e é conferido por CRC. Não inclui banco de feedback, artefatos de teste, credenciais ou conversas. O EXE continua sem certificado próprio do AEBOT.

## Limites e próximo passo

O BGE é um modelo de relevância, não um modelo gerador equivalente ao ChatGPT. Relaciona linguagem às regras, mas uma ambiguidade real ainda exige pergunta. Nenhuma suíte finita comprova 100% de acerto na linguagem livre. Os tempos medidos nesta máquina não certificam o Latitude.

O próximo passo operacional é reunir exemplos voluntários de dúvidas/erros, sem dados de cliente, revisar o gabarito com o responsável e acrescentar regressões antes de ampliar a distribuição. O pacote portátil não tem assinatura própria do AEBOT e não altera proteções do Windows.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
