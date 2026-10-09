# AEBOT — apresentação do projeto

## Abertura

Eu desenvolvi o AEBOT pensando nas dúvidas que aparecem enquanto analisamos as Ordens de Serviço. Queria reunir o conhecimento que usamos e criar uma ferramenta que ajudasse a consultar as regras e orientar o caso sem precisar interromper a análise para procurar tudo em lugares diferentes.

Hoje vou apresentar o projeto, o que já temos e como o aplicativo funciona. Depois vou abrir o AEBOT para mostrar a interface.

## O que já fazemos

O AEBOT trabalha com o serviço selecionado e o relato do analista. A base já trata enquadramento do serviço, Troca de Serviço, Adicional Executado e Adicional Posterior. Também inclui critérios de aferição, metragem e execução, além de diferenças que dependem da equipe, da superintendência ou da frente.

Temos 36 serviços cadastrados e 99 regras e orientações. A base reúne reparos de cavalete, ramal e rede, substituições de registro e hidrômetro, reaterros, repavimentações, corte, religação e outros serviços. A cobertura varia: oito cadastros ainda aguardam regras próprias. Estou aprofundando os testes em Repavimentação Asfalto e mantendo a evolução do restante.

## Como a conversa funciona

O analista escreve do seu jeito. A IA ajuda a relacionar o relato com as situações da base, mesmo quando as palavras mudam. O chat tem tratamento de continuidade do mesmo caso, respostas curtas às perguntas que ele fez e retificações explícitas. Para outra OS, começo um novo caso e separo o contexto.

A IA interpreta a linguagem. O motor confere se as regras se aplicam aos fatos e ao contexto, incluindo condições e exceções. Isso permite combinar ocorrências sem deixar a conclusão depender de uma regra inventada pelo modelo. Quando falta algo que muda a orientação, ele pode perguntar ou explicar o que precisa confirmar.

O AEBOT apoia a análise. O analista continua conferindo a OS e lançando a conclusão no sistema. O aplicativo não acessa nem altera a OS e não lê as fotos automaticamente.

## Manutenção da base

As regras ficam separadas do motor, em uma base que posso revisar e ampliar. Ela reúne critérios da análise, regras informadas pelos responsáveis e orientações úteis dos procedimentos de campo.

O aplicativo importa novas versões por pacote, confere os dados e preserva a anterior. O pacote informa quem revisou, a vigência e o que mudou. Essa autoria declarada não substitui assinatura ou distribuição confiável. Atualizar as regras não exige trocar o modelo de IA, e o chat não aprende regras novas automaticamente com as conversas.

## Rota atual do aplicativo

O projeto começou como extensão do Chrome e ganhou uma API online com painel administrativo de uso e feedback. Essa parte permanece no código como perfil legado.

Hoje estou trabalhando no aplicativo Windows com IA local. O pacote completo leva o modelo e os recursos necessários, sem pedir chave de API ou endereço de servidor ao analista. Depois de preparado, funciona offline e não depende da cota diária de um provedor online. O desempenho ainda depende da máquina e da complexidade da pergunta.

## Feedback e acompanhamento

O formulário permite enviar sugestões e problemas. O aplicativo salva apenas o feedback escrito voluntariamente, sem anexar o histórico da conversa.

As métricas locais contam análises, chamadas à IA, falhas e tempo médio. Posso exportar esses registros junto com a versão do aplicativo e da base. No desktop, eles não são enviados automaticamente para um painel central. As conversas ficam na memória e não são persistidas.

## Trabalho atual

Já temos o protótipo executável, a base organizada e testes automatizados, além de avaliação com a IA real. Estou trabalhando para melhorar a interpretação e o tempo de resposta, revisar situações com mais detalhes e ampliar a cobertura dos serviços. Vou continuar os testes com situações da nossa rotina e usar os resultados para ajustar o projeto.

## Demonstração

Vou mostrar o funcionamento, sem transformar a apresentação em treinamento de classificação:

1. Abro o catálogo e seleciono um serviço.
2. Mostro as diretrizes e a parametrização cadastradas.
3. Faço uma consulta sobre o serviço e continuo a conversa com uma informação complementar.
4. Mostro como começar outra OS sem misturar o contexto.
5. Abro o formulário de feedback e as configurações, mostrando a importação de regras e a exportação dos registros, sem aplicar uma atualização durante a apresentação.

Deixo o aplicativo aberto com antecedência e uso o pacote completo no disco local. Os slides têm notas de fala e o PDF fica disponível como apoio. O PowerPoint tem textos editáveis e pode ser importado no Canva, conferindo fontes e quebras depois da importação.

Projeto idealizado e desenvolvido por **Pedro Lucas Botelho**.
