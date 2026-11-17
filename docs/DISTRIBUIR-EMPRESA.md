# AEBOT na pasta da empresa

Em 17/11, conferi o OneDrive desta máquina: só há montagem pessoal, sem a biblioteca corporativa sincronizada. A central descrita abaixo está preparada no projeto, mas não foi publicada na empresa. O SharePoint receberá somente arquivos; o chat e a IA continuam locais. Commit no GitHub salva o código e não atualiza sozinho o EXE. Veja [Código e republicação](PUBLICAR-ATUALIZACOES.md).

## O que deixo disponível

Uso uma pasta **AEBOT ao lado da AutoForms**, dentro de Funcionalidades. Não coloco arquivos dentro da AutoForms nem altero suas permissões.

```text
Funcionalidades/
  AutoForms/                 (não altero)
  AEBOT/
    Instalar-AEBOT.exe        (o analista baixa este arquivo)
    channel.json             (catálogo assinado; não edito na mão)
    packages/                (pacotes completos e diferenciais por hash)
    installers/              (histórico dos instaladores)
    history/                 (histórico dos catálogos)
```

O endereço previsto é a pasta `Shared Documents/Funcionalidades/AEBOT` do site corporativo `analisequalidade`. Essa pasta ainda precisa ser criada/publicada por alguém com acesso ao SharePoint. Preparar e testar a pasta no projeto não significa que ela já está online na empresa.

## Publicar a entrega já preparada

1. Extraio `AEBOT-Central-Empresa-0.9.1.zip` inteiro. Dentro dele está a pasta **AEBOT**.
2. Abro **Funcionalidades** no SharePoint, um nível acima da AutoForms.
3. Envio a pasta **AEBOT** inteira, incluindo `packages` e `installers`. Não envio só o EXE nem movo a AutoForms.
4. Espero todos os arquivos terminarem de subir/sincronizar. Depois compartilho o acesso à AEBOT com os analistas.
5. Em cada computador, sigo a primeira instalação abaixo. Se a biblioteca ainda não estiver no Explorador, sincronizo pelo OneDrive uma vez.

Isso publica os arquivos públicos já assinados; não exige Python, chave privada ou integração do ChatGPT. Para revisões futuras, uso o procedimento de publicação ao final deste guia e publico o catálogo por último. Não misturo uma entrega antiga por cima de uma versão mais nova.

## Primeira instalação do analista

1. No SharePoint, adiciono a pasta AEBOT ao meu OneDrive ou sincronizo a biblioteca da empresa. Uso minha conta corporativa normal, não conecto o ChatGPT ao SharePoint.
2. Espero o OneDrive reconhecer a pasta no Explorador de Arquivos. Não preciso marcar todo o histórico como “sempre disponível”; só o pacote escolhido será lido.
3. Baixo `Instalar-AEBOT.exe` da pasta AEBOT e o abro.
4. Clico em **Procurar atualizações** e depois em **Instalar AEBOT**.
5. Se a detecção da pasta não funcionar, uso **Escolher pasta** uma vez e seleciono a AEBOT sincronizada. Esse caminho fica salvo somente neste computador.
6. Aguardo o download, a verificação e o teste automático. Clico em **Abrir AEBOT**.

A instalação padrão fica em `%LOCALAPPDATA%\AEBOT\Application`. Posso deixar o próprio `Instalar-AEBOT.exe` na Área de Trabalho: depois da primeira instalação, ele abre o aplicativo local nas próximas vezes. Também posso criar um atalho para `Abrir-AEBOT.exe` da pasta instalada. Não instalo Python, não configuro chave de IA e não preciso de permissão de administrador para gravar nessa pasta do meu perfil. Políticas do Windows ainda podem impedir executar um EXE sem certificado; não desativo proteções.

## Atualizar depois

No aplicativo, uso **Atualizar → Procurar atualizações → Atualizar agora**. Não escolho o arquivo de atualização nem reinstalo o modelo quando ele não mudou. O chat é fechado com confirmação para liberar a IA antes do teste da versão nova; feedbacks permanecem. O pacote é obtido da pasta sincronizada e só é ativado após assinatura, hashes e diagnóstico.

O resultado é referente ao **catálogo sincronizado neste computador**. Sem sincronização recente, não posso afirmar que ele representa o último arquivo online do SharePoint. Se a pasta não estiver disponível, o programa avisa e continua funcionando com a versão instalada; indisponibilidade não aparece como “atualizado”.

A leitura da distribuição roda em processo separado, com prazo e cancelamento. Não transmito perguntas, histórico, feedbacks ou métricas. Só leio catálogo e pacote quando o usuário pede. A análise continua offline. OneDrive é quem cuida do acesso corporativo e da transferência dos arquivos; não uso cookies do navegador nem senha dentro do AEBOT.

## Como publico uma revisão

1. Reviso regras e código; executo testes, auditorias e diagnóstico dos executáveis.
2. Gero uma pasta completa nova e seus pacotes assinados, incluindo um completo para primeira instalação e um diferencial para cada versão antiga suportada.
3. Publico os pacotes e o instalador com o comando abaixo, na pasta local sincronizada **AEBOT**. O catálogo é atualizado por último e seu anterior é preservado.
4. Espero o OneDrive terminar a sincronização antes de avisar os analistas.

Exemplo, substituindo o caminho da pasta pelo que aparece no meu Explorador:

```powershell
.\.venv\Scripts\python.exe python/publish_channel.py --directory "C:\CAMINHO-DA-EMPRESA\Funcionalidades\AEBOT" --installer python/dist/AEBOT-Python-0.9.1/Abrir-AEBOT.exe --package python/dist/AEBOT-completo-0.9.1.aebot-update --package python/dist/AEBOT-0.8.1-para-0.9.1.aebot-update --package python/dist/AEBOT-0.7.0-para-0.9.1.aebot-update --package python/dist/AEBOT-0.6.3-para-0.9.1.aebot-update
```

Não copio `.aebot-private`, o repositório, feedbacks ou a pasta `artifacts` para o SharePoint. A chave privada continua somente com o mantenedor. A pasta da empresa recebe exclusivamente os arquivos públicos de distribuição. Recomendo leitura para analistas e escrita apenas para quem publica, respeitando a política da empresa; o aplicativo não configura permissões.

A assinatura do catálogo e do pacote não é certificado Authenticode do Windows. Não há bypass de login ou de aprovação administrativa. O sistema não usa a integração ChatGPT/SharePoint que foi cancelada.

## Quando ainda não houver sincronização

Não prometo atualizar diretamente pelo link do navegador. É possível usar **Pacote manual** como contingência ou configurar a pasta sincronizada. Um download direto autenticado pelo SharePoint sem OneDrive exigiria outra integração/autorização, que não foi implantada nesta versão.

Referência: a [Microsoft documenta a sincronização de bibliotecas e atalhos do SharePoint pelo OneDrive](https://support.microsoft.com/en-us/sharepoint/sync/sync-sharepoint-and-teams-files-with-your-computer). Isso explica o funcionamento da sincronização, não comprova o acesso da empresa neste notebook.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
