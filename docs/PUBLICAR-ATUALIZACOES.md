# Código no GitHub e arquivos na pasta da empresa

## O que fica em cada lugar

O **GitHub** versiona o código, regras, testes e documentação de manutenção. A pasta **Funcionalidades/AEBOT** no SharePoint fica somente com os arquivos públicos de distribuição: instalador, pacotes assinados, catálogo e instruções. Não hospedo o chat, modelo como serviço, backend ou banco de conversas nessa biblioteca. O aplicativo e a inferência continuam locais em cada computador.

Não envio chave privada, credenciais, feedbacks ou relatórios de conversas ao GitHub ou à pasta da empresa. Modelos e builds grandes ficam fora do Git. Os arquivos locais de apresentação e relatório não fazem parte do instalador.

## Commit não é atualização instalada

Salvar um commit e dar push sincroniza os **fontes** com o GitHub. Isso não recompila nem troca o executável no computador do analista. Nesta entrega, não existe pipeline do GitHub que receba a chave privada de assinatura ou publique no SharePoint.

Para distribuir uma mudança de código ou regra:

1. Reviso e testo a alteração e incremento a versão do aplicativo. Se mudar uma regra, incremento também a base e acrescento gabaritos.
2. Salvo o commit e confiro o push da branch no GitHub. Não apago alterações de terceiros para deixar a árvore limpa.
3. Gero uma pasta completa nova, executo o EXE real e preparo o pacote completo e os diferenciais para as versões suportadas. Preservo as entregas anteriores.
4. Assino os pacotes com a chave privada que fica só com o mantenedor. Não a coloco no repositório nem na pasta corporativa.
5. Publico na pasta **AEBOT sincronizada pelo OneDrive**, com `publish_channel.py`. Ele copia pacotes imutáveis, preserva históricos e troca o catálogo assinado por último. Não publico sobre uma versão mais nova.
6. Espero a sincronização terminar e confiro os arquivos pelo SharePoint ou em outro computador autorizado. Cópia local não é prova de upload concluído.
7. O analista usa **Atualizar → Procurar atualizações → Atualizar agora**. O app escolhe o pacote compatível, verifica assinatura/hashes e testa antes de ativar. Feedback e versão anterior permanecem.

As etapas 3 a 6 são a republicação do aplicativo. Um commit só de documentação não precisa obrigar todos a baixar outra versão do modelo.

## Primeira publicação da 0.9.1

A central pronta está em `python/dist/Empresa-0.9.1/AEBOT` e no ZIP `AEBOT-Central-Empresa-0.9.1.zip`. É uma pasta já verificada, ainda local. Para instaladores que não dependam da biblioteca sincronizada na primeira instalação, há também `AEBOT-Instalar-0.9.1-Testes-16-11-2026.zip`, com modelo e pacote completos. Não troco o `Instalar-AEBOT.exe` da central pelo instalador offline: são pontos de entrada diferentes.

Para copiar a central pronta, envio a pasta **AEBOT inteira** a Funcionalidades, ao lado da AutoForms. Os pacotes e instaladores precisam terminar de sincronizar antes do `channel.json`. Não envio o repositório inteiro. O guia [Distribuir na empresa](DISTRIBUIR-EMPRESA.md) detalha a estrutura e o comando para as próximas versões.

## Situação conferida em 17 de novembro de 2026

Consultei os pontos de montagem publicados pelo OneDrive fora do isolamento, sem ler tokens, senhas ou cookies. Só apareceu a montagem pessoal `d.docs.live.net`; não apareceu biblioteca de `aegeactl.sharepoint.com`. Não existe origem corporativa salva no atualizador desta máquina.

Por isso, **a pasta da empresa não foi publicada nem o acesso de outra máquina foi confirmado**. Não crio uma pasta dentro do OneDrive pessoal e a apresento como se fosse corporativa. Para concluir essa parte, a biblioteca autorizada precisa estar sincronizada e o caminho local da AEBOT precisa estar acessível. Não conecto o ChatGPT ao SharePoint nem implemento OAuth/Graph como atalho.

A assinatura dos pacotes protege sua integridade; não substitui certificado Authenticode ou liberação do executável pelo Windows. Não altero proteções para fazer a distribuição funcionar.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
