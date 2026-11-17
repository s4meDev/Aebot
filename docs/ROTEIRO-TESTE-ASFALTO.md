# AEBOT — conferência rápida para os testes

Aplicativo 0.9.1 · Base 2.20.0 · 16/11/2026

Antes de usar em uma dúvida real, espero **IA local pronta** e faço os controles abaixo. Repito nas duas faixas de Repavimentação Asfalto. Não uso dados de clientes. Este roteiro confere pontos importantes; não é garantia de todas as combinações possíveis.

## 1. Conversa com esclarecimento e retificação

Em **Novo caso**, escrevo cada mensagem e aguardo a resposta:

| Minha mensagem | Resultado esperado |
| --- | --- |
| Sem aferição da vala. | Pergunta o tipo da equipe; ainda não recomenda conclusão oficial. |
| interna | Não Conforme, com orientação de Retrabalho na OS atual. Não repete a pergunta de equipe. |
| E qual é a regra da foto depois? | Explica a regra como consulta, sem registrar que faltou a foto nesta OS. |
| Corrigindo: é terceirizada. | Retoma a falta de aferição do caso e recomenda Reprovado na OS atual. |

Em outro **Novo caso**:

| Minha mensagem | Resultado esperado |
| --- | --- |
| A trena impede verificar a metragem. Equipe interna. | Não Conforme + orientação de Retrabalho, não reprovação automática. |
| Corrigindo: não tenho certeza se é interna. | Volta a perguntar o vínculo, sem manter a certeza anterior como confirmação. |
| terceirizada | Reprovado na OS atual pela regra aplicável. |

## 2. Escopo, exceção e conflito

Uso **Novo caso antes de cada linha**:

| Relato/consulta | Resultado esperado |
| --- | --- |
| OS de origem sem aferição. Frente Manutenção. | Não Conforme pela condição da origem. |
| OS de origem sem aferição. Frente VCG. | Explica a exceção cadastrada; não aprova a OS inteira e não aplica automaticamente a regra de Manutenção. |
| Sem foto antes. Acabamento inadequado. | Reprovado pelo acabamento; Ver fundamentos mantém também a falta da foto antes. |
| Executaram concreto no lugar do asfalto. | Reprovado pelo material incompatível. |
| Código incompatível com a execução. O sistema permite trocar. | Não Conforme com orientação de troca. |
| Serviço incompatível sem possibilidade de troca. | Reprovado por impossibilidade de troca. |
| Falta de adicional posterior necessário. | Não Conforme, com correção de parametrização. |
| O serviço foi executado. | Não aprova a OS somente com essa frase genérica. |

## 3. Consulta e hipótese não viram fatos

Em **Novo caso**, pergunto **“Qual a diferença na falta de aferição entre equipe interna e terceirizada?”**. Deve explicar os dois caminhos, sem escolher a última equipe nem classificar uma OS real.

Em outro caso, escrevo **“Se faltar aferição da vala?”**, depois **“interna”**. Deve apresentar orientação **condicional** de Não Conforme + Retrabalho, sem tratar a hipótese como uma OS real já classificada.

## 4. Interface e feedback

Confiro se consigo enviar uma mensagem na janela menor, consultar **Ver fundamentos** e **Regras e fluxo**, começar **Novo caso** e retificar sem misturar OS. A conversa não deve reaparecer depois de fechar e abrir.

Se quiser testar o feedback, uso descrição claramente marcada **“Teste de instalação, sem dados reais”**. Confiro em **Feedbacks salvos**, exporto JSON e entrego ao responsável. Esse registro é voluntário e permanece salvo; não há envio automático. O próprio instalador já testa o formulário com um banco sintético separado, sem gravar um feedback real.

## Se algum controle divergir

Registro voluntariamente o texto, a orientação recebida, a esperada e o serviço escolhido no formulário de feedback. Não incluo dados identificáveis de OS/clientes e não uso a resposta divergente para encerrar a análise. Tempos podem ser descritos no formulário se eu desejar; não são coletados automaticamente.

Na auditoria anterior do motor, 1.554 de 1.556 cenários passaram integralmente. Duas divergências históricas permanecem registradas: consulta de duplicidade que cita a regra e uma expressão ambígua sobre falta de registro da execução. Não são falhas escondidas nem prova de acerto universal. Os resultados detalhados acompanham a instalação em `RESULTADOS-TESTES.md`.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
