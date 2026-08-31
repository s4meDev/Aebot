# Guia rápido para teste do AEBOT

Este guia é destinado aos analistas que participarão do piloto. Cada pessoa recebe a mesma pasta da extensão e um token individual diferente.

## Instalação

1. Salve a pasta `dist` em um local que não será apagado durante o piloto.
2. No Chrome, abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta `dist`.
5. Fixe o AEBOT na barra do Chrome e clique no ícone para abrir o painel lateral.

Não altere nem compartilhe o token recebido. Ele identifica somente o acesso operacional e permanece salvo nesse perfil do Chrome.

## Primeiro acesso

1. Clique em **Config**.
2. Cole o token individual entregue pelo responsável.
3. Clique em **Salvar Alterações**. O AEBOT valida API, token e catálogo antes de salvar.
4. Confirme que o chat mostra **Online · Gemini** ou **Online · Workers AI**.

Se o token não for aceito, copie a mensagem de erro e informe ao responsável pelo piloto. Não envie o token em print, e-mail ou feedback.

## Como testar

1. Selecione o serviço real da Ordem de Serviço.
2. Descreva a dúvida ou os fatos como você escreveria normalmente, inclusive de forma informal.
3. Confira a decisão, a justificativa, as regras utilizadas e a orientação.
4. Para acrescentar um fato ao mesmo caso, use uma continuação clara, como “também faltou a foto antes”.
5. Para analisar outra OS, clique em **Novo caso**. Isso evita misturar informações.

O AEBOT só pode recomendar `Conforme`, `Não Conforme` ou `Reprovado` quando houver regra suficiente. Uma resposta sem decisão é intencional quando a base ainda não cobre o cenário.

## Enviar feedback

Use o botão **Feedback** quando:

- a resposta estiver errada;
- faltar uma regra ou um tipo de caso;
- a explicação estiver difícil de entender;
- houver problema na interface;
- existir uma sugestão.

Explique o comportamento esperado, mas não informe número da OS, nome, endereço, matrícula ou qualquer dado pessoal. A conversa não é anexada automaticamente ao feedback.

## Atualização

Quando receber uma pasta `dist` nova, substitua a pasta anterior e clique em **Atualizar** no cartão do AEBOT em `chrome://extensions`. A identidade estável preserva o ID da extensão e o token salvo, desde que o perfil do Chrome e os dados da extensão não sejam apagados.
