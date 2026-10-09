# AEBOT — roteiro da apresentação

## Abertura

Eu criei o AEBOT pensando nas dúvidas que aparecem durante a análise de uma OS. Às vezes é uma foto que falta, um desdobro que precisa ser corrigido ou um detalhe da execução que muda a conclusão. A ideia é ter um assistente para consultar essas situações usando as regras da nossa análise.

## O que quero mostrar

Na nossa operação, cerca de 40 analistas revisam pouco mais de 3.000 OS por dia. Esse é o contexto em que pensei no projeto, não uma quantidade de análises já feita pelo aplicativo.

O analista escolhe o serviço e descreve o que encontrou. Pode escrever com suas palavras e continuar a conversa. O AEBOT relaciona o relato com as regras e orienta o que fazer. A conferência das fotos e o registro da conclusão no sistema continuam sendo responsabilidade do analista. Hoje o aplicativo não acessa nem altera a OS e não lê as fotos automaticamente.

As conclusões continuam sendo Conforme, Não Conforme e Reprovado. Se faltar uma informação que mude a orientação, ele precisa perguntar. Se não houver regra suficiente, precisa explicar isso em vez de inventar uma conclusão.

## Exemplos que vou explicar

Estou concentrando os ajustes em Repavimentação Asfalto. No slide de exemplos, cada linha representa uma OS diferente, sem outras falhas relatadas:

- Falta apenas a foto antes: Não Conforme.
- Falta a foto depois: Reprovado.
- Faltam as fotos antes e durante: Reprovado pela combinação das ausências.

Outro exemplo é uma OS de repavimentação sem aferição da vala. Nesse caso, importa saber se a equipe é interna ou terceirizada. Sendo interna, a orientação é Não Conforme com geração de retrabalho. Sendo terceirizada, é Reprovado. Esse exemplo trata do serviço original da OS; quando está no Adicional Executado, a base tem orientações próprias.

## Como o aplicativo funciona

A versão atual roda no próprio notebook, com a IA e as regras locais. Depois de instalado o pacote completo, não depende de internet nem de chave de API para analisar os relatos. As conversas não ficam salvas. Feedbacks e métricas ficam no computador e podem ser exportados.

A base reúne as regras por serviço, os procedimentos de apoio e a parametrização de Troca de Serviço, Adicional Executado e Adicional Posterior. Posso acrescentar regras e corrigir as existentes conforme surgirem necessidades. Outros serviços já estão cadastrados, e continuo trabalhando na cobertura da base.

## Demonstração

1. Abro o AEBOT e seleciono a faixa correta de Repavimentação Asfalto.
2. Inicio um caso e escrevo: **“Sem foto depois.”** Mostro a recomendação e a regra utilizada.
3. Uso **Iniciar novo caso** para não misturar as duas situações.
4. Escrevo: **“A OS de repavimentação está sem aferição da vala.”** Quando ele perguntar sobre a equipe, respondo **“interna”**.
5. Confiro a indicação de Não Conforme com geração de retrabalho e mostro como a resposta curta continua a conversa.

O primeiro exemplo demonstra uma recomendação direta. O segundo mostra por que, em algumas situações, ele precisa perguntar antes de orientar.

## Encerramento

Quero continuar testando situações da nossa análise, melhorar a interpretação dos relatos e deixar as respostas mais úteis e rápidas. Esses testes também ajudam a identificar onde preciso ajustar ou acrescentar regras.

## Antes de apresentar

- Deixo o notebook na tomada e abro apenas uma instância do AEBOT.
- Uso o pacote completo no disco local, sem executar dentro do ZIP ou copiar só o EXE.
- Abro o aplicativo com antecedência e confiro se a IA está pronta.
- Deixo o PDF disponível para mostrar os slides, caso precise.

O arquivo `AEBOT_Apresentacao.pptx` tem textos editáveis e notas de apresentação. Posso abrir no PowerPoint ou importar no Canva; após importar, confiro fontes e quebras de linha. O PDF é uma cópia visual dos slides.

Projeto idealizado e desenvolvido por **Pedro Lucas Botelho**.
