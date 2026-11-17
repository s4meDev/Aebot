# Como atualizo o AEBOT sem baixar tudo de novo

## Atual — 0.9.1 pela pasta da empresa

Para quem já está na 0.8.1, posso usar **Atualizar → Pacote manual** com `AEBOT-0.8.1-para-0.9.1.aebot-update`. O ZIP `Atualizacao-AEBOT-0.8.1-para-0.9.1.zip` reúne esse pacote, o atualizador e o guia. Não extraio por cima da instalação: abro Atualizar-AEBOT.exe na pasta separada e, se necessário, uso Alterar instalação para apontar a original. A central, depois de publicada, seleciona esse mesmo diferencial automaticamente.

A pasta prevista é **Funcionalidades/AEBOT**, separada da AutoForms e sincronizada pelo OneDrive. A criação/publicação real e o acesso corporativo ainda precisam ser confirmados. Não conecto o ChatGPT ao SharePoint.

No app, uso **Atualizar → Procurar atualizações → Atualizar agora**. O canal escolhe o pacote para a versão e o manifesto instalados, confere assinatura e hashes, prepara a pasta nova e testa o EXE antes de ativar. A versão anterior e os feedbacks são preservados.

Na primeira instalação, baixo `Instalar-AEBOT.exe` da pasta central e uso **Procurar atualizações → Instalar AEBOT**. A biblioteca deve estar sincronizada; se não for localizada automaticamente, escolho a pasta AEBOT uma única vez. Detalhes em [Pasta da empresa](DISTRIBUIR-EMPRESA.md), copiado como `PASTA-DA-EMPRESA.md` no pacote.

Não é download HTTP público pelo link do SharePoint. O OneDrive faz o acesso corporativo, e o resultado da consulta reflete o catálogo sincronizado neste computador. Sem fonte disponível, há aviso — não uma confirmação falsa de atualização. Pacote manual continua como contingência. Os procedimentos abaixo são o histórico da transição 0.7.0 e continuam úteis para pacotes antigos.

## Para quem já usa a 0.6.3

Na entrega atual, uso `Atualizacao-AEBOT-0.6.3-para-0.9.1.zip`: extraio tudo, fecho o chat, abro Atualizar-AEBOT.exe e uso **Alterar instalação** para escolher a pasta original. Clico em **Pacote manual**, seleciono o arquivo incluído e clico em **Atualizar agora**. Quem está na 0.7.0 usa a transição equivalente `Atualizacao-AEBOT-0.7.0-para-0.9.1.zip`. A partir daí, o botão do app usa a central sincronizada quando ela estiver publicada. Os passos abaixo registram a tela antiga da 0.7.0, não os nomes dos botões atuais.

A versão antiga ainda não tinha atualizador. Faço esta transição uma vez:

1. Baixo o ZIP **Atualizacao-AEBOT-0.6.3-para-0.7.0.zip** e extraio tudo numa pasta separada.
2. Fecho o chat do AEBOT. A conversa não é salva; os feedbacks permanecem.
3. Abro **Atualizar-AEBOT.exe**, que veio nesse ZIP.
4. Em **Pasta original**, seleciono a pasta antiga que contém `AEBOT.exe`, `resources` e `_internal`. Não escolho o ZIP.
5. O arquivo `.aebot-update` da mesma pasta já fica selecionado. Confiro a versão e clico em **Aplicar**.
6. Aguardo a conferência e o teste automático. Depois clico em **Abrir AEBOT**.
7. Daqui em diante, abro **Abrir-AEBOT.exe na pasta original**. Posso criar um atalho para ele. O `AEBOT.exe` antigo da 0.6.3 não foi sobrescrito e continua sendo a versão antiga.

Não reinstalo, não instalo Python e não cadastro chave. O modelo igual vem da própria instalação; não é baixado novamente. O arquivo de transição é específico para a 0.6.3. Se estiver em outra versão, preciso do pacote correspondente ou da pasta completa nova.

## Nas próximas atualizações

1. Baixo o arquivo **`.aebot-update`** publicado pelo responsável. Não preciso extrair esse arquivo.
2. No AEBOT, clico em **Atualizar** e confirmo o fechamento do chat.
3. Seleciono o arquivo baixado e clico em **Conferir pacote → Aplicar**.
4. Depois de terminar, clico em **Abrir AEBOT**. O mesmo `Abrir-AEBOT.exe` abre a versão ativa nas próximas vezes.

É uma atualização por arquivo baixado, não um download automático pela internet. O funcionamento da análise continua offline. O tamanho varia: se só o código ou as regras mudarem, o modelo não entra no download; se o próprio modelo mudar, os arquivos novos dele precisam ser incluídos.

## Se falhar

A versão anterior não é apagada. Não misturo arquivos nem extraio a atualização por cima do app. Confiro a mensagem e guardo uma captura sem dados de OS.

Para voltar, abro o atualizador e uso **Voltar versão**, com o chat fechado. Se a versão ativa não abrir, executo `Abrir-AEBOT.exe --update` por um atalho ou pelo PowerShell na pasta original:

```powershell
.\Abrir-AEBOT.exe --update
```

Não preciso alterar a Execution Policy. Não desativo antivírus ou controles do Windows. A assinatura interna do pacote verifica o publicador da atualização, mas **não é um certificado do Windows** e não elimina bloqueios de EXE.

O atualizador precisa conseguir escrever na pasta original e ter espaço para manter duas versões. Ele reutiliza os arquivos por cópia local, não por links; economiza download, não necessariamente espaço no disco. Não há limpeza automática das versões ou de estágios interrompidos nesta entrega.

## O que é preservado

Feedbacks continuam em `%LOCALAPPDATA%\AEBOT\Python\feedback.sqlite3`, fora da pasta atualizada. O atualizador não lê nem copia esse banco. Não anexa conversas, não coleta métricas e não altera regras do responsável sozinho. O chat continua apenas em memória e é descartado ao fechar para atualizar.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
