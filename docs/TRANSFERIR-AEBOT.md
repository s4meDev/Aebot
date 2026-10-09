# Levar o AEBOT para outro computador

Preparei uma entrega que pode ser enviada pelo WhatsApp como **Documento**. Ela usa o protótipo portátil 2.22.1 já publicado, sem trocar o modelo, as regras ou o executável.

## O que baixar e enviar

No [pré-lançamento 2.22.1](https://github.com/s4meDev/Aebot/releases/tag/v2.22.1-prototipo), baixe:

- `AEBOT-2.22.1.zip.001`;
- `AEBOT-2.22.1.zip.002`;
- `AEBOT-2.22.1.zip.003`;
- `AEBOT-2.22.1.zip.004`;
- `COMECE-AQUI-2.22.1.zip`.

Envie esses cinco arquivos, sem renomear. O ZIP pequeno contém o passo a passo em `LEIA-PRIMEIRO.txt`, o montador `JUNTAR-PACOTE.cmd` e os hashes. Pode enviar o TXT separado também. Não precisa mandar o código-fonte, VS Code ou um Setup antigo.

O ZIP completo tem aproximadamente 3,5 GB. Por isso, as partes têm no máximo 1 GiB cada, abaixo do [limite de documentos informado pelo WhatsApp](https://www.whatsapp.com/messaging?lang=pt). Para pendrive, pode levar a pasta inteira da entrega. Se o meio de envio não aceitar as partes, encaminhe o link do pré-lançamento para baixar diretamente no PC.

## No computador que recebe

1. Baixe os cinco arquivos na mesma pasta local. Use Windows 10/11 de 64 bits e reserve 16 GB livres durante a montagem e extração.
2. Extraia `COMECE-AQUI-2.22.1.zip` pelo Explorador. Copie o conteúdo extraído para junto das partes `.001` a `.004`.
3. Abra `JUNTAR-PACOTE.cmd`. Aguarde a conferência e a mensagem de ZIP concluído.
4. Extraia `AEBOT-2.22.1.zip` e abra `AEBOT-Prototipo.exe` na pasta extraída. Mantenha todos os arquivos e subpastas juntos.
5. Aguarde a IA, escolha o serviço e converse sobre a OS. Para outra OS, use **Iniciar novo caso**.

O aplicativo funciona offline depois da cópia. Não pede chave, conexão ou instalação de ferramentas. A primeira abertura e algumas análises podem demorar. O protótipo ainda não tem assinatura própria ou homologação operacional. Se o Windows bloquear o montador ou o aplicativo, pare e guarde a mensagem. Não altere proteções para executá-lo.

Não leia “sem cota de provedor” como garantia de rapidez ou acerto. Confira as orientações antes de agir na OS. Conversas não são salvas; feedback e métricas ficam no próprio PC e precisam ser exportados pelas configurações para encaminhar ao responsável.

## Preparar novamente no workspace

Depois de `desktop:prototype` e `desktop:download`, use a pasta **download** da versão atual:

```powershell
npm.cmd run desktop:transfer -- desktop-release/download-2.22.1-2026-10-08T20-01-41-175Z
```

O comando cria uma pasta nova `desktop-release/PARA-ENVIAR-AEBOT-<versão>-<data>`. Confere o manifesto, os hashes de cada parte, o ZIP formado por elas e as cópias. Só inclui as partes, o guia e o ZIP de apoio. Não copia perfis, credenciais ou conversas, não executa a IA e não publica automaticamente.

Os arquivos grandes são gerados localmente e ficam fora do Git. Commit e sincronização salvam o código, os testes e os guias. A publicação dos downloads é uma etapa separada; não substitua partes antigas por partes de outro ZIP.

Projeto idealizado e conduzido por **Pedro Lucas Botelho**.
