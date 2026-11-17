# Atualização de critério — trena e aferição

Python 0.5.1 · Base 2.20.0 · 03/11/2026

## Decisão confirmada pelo responsável

Pedro Lucas Botelho Naus confirmou que, na OS atual de Repavimentação Asfalto, a equipe interna com trena que impede verificar a metragem segue o mesmo tratamento da falta de aferição: **Não Conforme + Retrabalho**. Essa confirmação substitui a antiga reprovação automática do cadastro de trena.

| Contexto confirmado da OS atual | Orientação |
| --- | --- |
| Interna e trena impede conferir a metragem | Não Conforme; gerar Retrabalho da mesma Repavimentação, com aferição comprovada. |
| Terceirizada e trena impede conferir a metragem | Reprovado por falta de aferição verificável. |
| Vínculo não informado | Perguntar se é interna ou terceirizada; não escolher conclusão oficial. |
| Só mencionou trena ou a medição está legível | Não presumir impedimento nem irregularidade. |
| Existe outra falha independente que justifique reprovação | Essa regra continua aplicável. Não Conforme da trena não anula uma reprovação sustentada por outro fato. |

O escopo desta retificação é a aferição do serviço atual. As regras próprias de OS de origem e Adicional Executado continuam separadas; não copiei a reprovação do original para o adicional.

## Implementação

Mantive o ID `RULE-ASF-TRENA-01`, agora condicionado à equipe interna. Acrescentei a alternativa terceirizada e a pergunta por equipe. As três compartilham o mesmo fato de interpretação e os dois serviços de Asfalto. O motor Python não recebeu IDs, decisões ou heurísticas de serviço.

A fonte compartilhada passou de 2.19.0 para 2.20.0: 36 serviços e 102 regras. O perfil contém dois serviços e 39 regras/orientações aplicáveis. Todos os outros serviços foram preservados. Guia e diagrama foram regenerados da fonte.

Atualizei dois gabaritos antigos de trena sem equipe: antes esperavam Reprovado; agora precisam aguardar o contexto. Isso é mudança de critério autorizada, não ajuste de gabarito para esconder saída do modelo. Acrescentei uma matriz para cada faixa, com interna, terceirizada, contexto ausente, respostas curtas, retificação, paráfrases, negação e outra falha independente.

Na conferência dos contratos do legado, uma citação ampla com “apresentou trena” pode ser tratada como presença pelo validador antigo e resultar em abstenção. Mantive a exigência de citação factual precisa no contrato; não refiz o motor do legado para esta retificação. O Python foi testado também com a frase completa “A equipe interna apresentou trena que não permite conferir a metragem” e retorna Não Conforme com Retrabalho. Essa diferença de implementação não é anunciada como homologação do antigo Electron.

Os resultados anteriores de `PRONTIDAO-ASFALTO-2026-11-03.md` permanecem históricos, medidos na base 2.19.0. Esta entrega tem sua própria validação. Não prometo 100% de acerto em linguagem livre.

## Validação da entrega

| Verificação | Resultado |
| --- | --- |
| Unittest Python | 108 aprovados. |
| Vitest do legado | 878 aprovados, um ignorado. Inclui os contratos atualizados sem inventar equipe. |
| Typecheck e build | Aprovados. |
| Matriz de trena com modelo real | 24/24 cenários aprovados nas duas faixas de área. |
| Auditoria completa com modelo real | 1.298/1.302 no critério completo; 1.301/1.302 decisões esperadas; nenhuma decisão oficial indevida ou falha técnica nessa amostra. |

As quatro divergências já conhecidas permanecem: citação de regra em consulta de duplicidade, abstenção num relato informal sem objeto de evidência explícito e recuperação insuficiente de uma paráfrase vaga em cada faixa. Não removi esses casos nem os contei como acertos. A retificação de trena não criou nova divergência na auditoria.

O corpus antigo recebeu também uma verificação explícita de pergunta pendente (`requiresQuestion`). Retornar null sem perguntar a equipe não é suficiente nos dois novos gabaritos de trena sem vínculo. O relatório da rodada atual fica em `python/artifacts/full-051-final-2026-11-03.json`, com hashes da fonte final. Esses cenários são sintéticos, não homologação operacional.

O corpus independente passou em 52/53 no critério completo, com a divergência antiga de citação; as 53 decisões esperadas coincidiram. Nos dois relatos de trena sem equipe, conferi também a pergunta pendente. Os 16 cenários semânticos adicionais passaram com modelo real e rede bloqueada no teste.

A janela passou com modelo real, inclusive no fluxo “trena impede verificar” → pergunta de equipe → “interna” → Não Conforme com Retrabalho. Os testes também conferiram Novo caso, os dois serviços, esclarecimento de trecho ambíguo e feedback voluntário sem anexar conversa.

O EXE gerado passou em três diagnósticos com modelo real, base 2.20.0, interface e SQLite temporário de teste. Usei a execução fora da restrição do sandbox para esses diagnósticos, sem alterar proteções do Windows nem acessar o feedback do analista. O pacote usa a mesma projeção validada da fonte, com 39 regras/orientações. O pacote anterior foi preservado.

Na auditoria completa, as mensagens com chamada real ao BGE levaram em média 1,31 s (P95 2,77 s; máximo 3,14 s) nesta máquina. Conferir/carregar o motor levou 3,95 s, separado da análise. São medições locais, não uma promessa para todos os notebooks. As 39 regras/orientações apareceram nos cenários sintéticos; isso não demonstra todas as formas possíveis de escrever um caso real.

O aplicativo continua offline, sem chave, telemetria ou persistência automática do chat. Feedback continua voluntário. O pacote não tem assinatura própria e não altera controles do Windows.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
