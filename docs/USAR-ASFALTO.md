# AEBOT — começar a usar em Repavimentação Asfalto

## Abrir

1. Na primeira instalação, copio o **AEBOT-Python-0.9.1.zip** inteiro para o notebook. Com a central da empresa publicada e sincronizada, também posso usar Instalar-AEBOT.exe.
2. Clico com o botão direito → **Extrair Tudo**. Não executo de dentro do ZIP.
3. Entro na pasta extraída e abro **Abrir-AEBOT.exe**.
4. Espero **IA local pronta** e escolho até ou acima de 1 m².

O pacote já leva aplicativo, modelo e regras. Não instalo Python, servidor ou chave. Não preciso de internet para analisar. Mantenho `resources` e `_internal` na pasta original. Nas próximas revisões, baixo o `.aebot-update` e uso **Atualizar** no app, sem extrair nem misturar arquivos. Se já uso a 0.6.3, sigo primeiro `COMO-ATUALIZAR.md` para a transição única.

## Analisar uma OS

Descrevo o que realmente vi nas evidências. Posso informar mais de uma falha e complementar a conversa. O aplicativo não vê fotos nem acessa Field/SCAE.

- Se ele perguntar um detalhe, respondo no mesmo chat. Só confirmo equipe, frente ou disponibilidade de troca depois de conferir.
- Quando aparecerem opções abaixo da conversa, escolho a informação que confirmei nas evidências. O aplicativo não escolhe por mim. Também posso continuar digitando normalmente.
- Se não sei, digo que ainda não confirmei. O assistente deve perguntar, não escolher um vínculo.
- Para retificar, escrevo **“Corrigindo: …”**. Para substituir o trecho que ele pediu para explicar, uso **“Quis dizer: …”**.
- Posso consultar uma regra sem afirmar que ocorreu. **“Se…”** simula um cenário, sem alterar a OS real.
- Posso perguntar sobre dois assuntos, como foto antes e depois. Se a consulta ficou incompleta, **“Quis dizer: …”** esclarece essa dúvida, sem registrar uma falha na OS.
- Para voltar da simulação, escrevo **“Voltando ao caso real: …”**.
- Em **Ver fundamentos**, confiro os critérios e trechos usados. Em **Regras e fluxo**, consulto a base e o diagrama.
- Para outra OS, clico em **Novo caso**. Fechar a janela também apaga o chat.

Em janelas largas, o resumo lateral mostra os relatos e o contexto deste caso. Na janela menor ele fica recolhido; **Ver fundamentos** mantém os critérios completos. Posso preparar outro rascunho enquanto a análise roda. Se der erro, o texto enviado volta ao campo somente se eu não tiver escrito um rascunho novo. **Copiar resposta** inclui as regras; nada é copiado automaticamente para feedback.

A orientação é de apoio. Confiro a OS antes de lançar a conclusão no sistema da empresa. O AEBOT não corrige formulários, cria retrabalho, troca serviços ou cancela ordens por conta própria.

## Conferência rápida antes de começar

Faço cada exemplo em **Novo caso**, nas duas faixas. São controles simples da instalação, não prova de todas as situações possíveis.

| Escrevo | Deve acontecer |
| --- | --- |
| Sem foto antes. | Não Conforme por falta da foto antes. |
| Sem foto antes e sem foto durante. | Reprovado pela combinação das ausências. |
| Sem aferição da vala. | Pergunta sobre o vínculo; não conclui ainda. |
| Respondo “interna” à pergunta anterior. | Não Conforme + orientação de Retrabalho. |
| Corrigindo: é terceirizada. | Reprovado na OS atual. |
| Não está sem foto depois. | Não usa essa frase para reprovar ou aprovar a OS inteira. |
| Me explique a falta de aferição. | Explica os caminhos sem classificar uma OS real. |

Se algum controle divergir, não uso aquela orientação para concluir a OS: registro o problema em **Enviar feedback** e confiro a base com o responsável.

## Se encontrar uma resposta errada

Em **Enviar feedback**, descrevo voluntariamente o caso sem número de OS ou dados do cliente e escrevo a orientação esperada. O formulário não copia o chat automaticamente. Ele fica salvo neste computador; não é enviado pela internet.

Em **Feedbacks salvos → Exportar JSON**, gero o arquivo para o responsável. Ele reúne os arquivos por **Importar JSON** na própria instalação. O feedback não vira regra sem revisão.

## Limites desta entrega

O foco são as duas faixas de Asfalto, com 39 regras/orientações da base 2.20.0. O modelo BGE associa o texto às regras; não é um ChatGPT gerador. Relatos ambíguos podem precisar de esclarecimento. Os resultados medidos estão em `RESULTADOS-TESTES.md`; não há garantia de 100% ou do mesmo tempo em qualquer notebook.

O aplicativo ainda não tem assinatura digital própria. Se o Windows bloquear, guardo a mensagem completa para diagnóstico. Não desativo proteções para executá-lo.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
