# AEBOT no Latitude — passo a passo para teste

## O que estou entregando agora

A versão 2.22.0 é um **protótipo portátil**, não um Setup empresarial homologado. Ela já leva o aplicativo, o modelo local e o runtime. O Latitude não precisa de VS Code, Node, chave de API, URL ou servidor online.

Ainda há uma divergência importante no teste da IA: duas etapas ausentes em linguagem informal podem resultar em Não Conforme quando deveriam reprovar. Use com conferência humana; não tome a resposta como aprovação automática da OS. O resultado completo está em [Desempenho local](DESEMPENHO-IA-LOCAL.md).

Uma tentativa de abrir o EXE 2.22.0 nesta máquina foi bloqueada pelo Controle de Aplicativo do Windows. Não posso garantir que abra no Latitude. Assinatura/liberação e qualidade da análise são etapas diferentes: liberar o EXE não corrige nem acelera o modelo.

## 1. Levar a pasta certa

No computador de desenvolvimento, a pasta final está em:

```text
desktop-release\prototipo-2.22.0-2026-10-08T18-52-43-897Z\win-unpacked
```

Copie **todo o conteúdo de `win-unpacked`**, usando o meio de transferência permitido pela empresa. Não leve somente o EXE. Não precisa copiar o workspace, `node_modules`, modelos candidatos ou pacotes antigos.

Dentro da pasta, devem continuar juntos:

- `AEBOT-Prototipo.exe`;
- a pasta `resources`, incluindo `app.asar` e `local-ai`;
- o GGUF, o runtime e o catálogo preparado, nas subpastas originais;
- as DLLs e demais arquivos do Electron;
- `LEIA-ME.txt` e `SHA256SUMS.txt`.

O código fica no Git; esses arquivos grandes são gerados e não acompanham o commit. Para reconstruir em outra máquina de desenvolvimento, siga [Executar e testar](EXECUTAR-E-TESTAR.md).

## 2. Copiar para o Latitude

1. Confira se o Windows é de 64 bits e se o Latitude tem os 16 GB de RAM previstos. Reserve pelo menos 5 GB livres no disco para a pasta, além do espaço usado pelos sistemas de trabalho.
2. No Explorador de Arquivos, digite `%LOCALAPPDATA%` na barra de endereço.
3. Se esse local for permitido pela empresa, crie `AEBOT-Prototipo` e, dentro dela, `2.22.0`. Se houver um local corporativo definido, use esse local.
4. Cole ali todo o conteúdo de `win-unpacked`, preservando nomes e subpastas. Aguarde a cópia terminar. Não execute pela pasta do pendrive, dentro de arquivo compactado ou em pasta disponível somente na nuvem.
5. Não misture arquivos da versão nova com uma instalação antiga. Deixe cada versão em sua própria pasta.

Esse processo é a preparação do portátil; não aparece um assistente de instalação e não exige elevação por conta do aplicativo. As políticas da empresa podem, mesmo assim, impedir copiar ou executar.

## 3. Abrir pela primeira vez

1. Ligue o notebook à tomada e deixe apenas uma instância do AEBOT aberta.
2. Abra `AEBOT-Prototipo.exe` na pasta copiada.
3. Se o Windows bloquear, **pare**. Guarde a mensagem e encaminhe ao suporte autorizado. Não desative Defender/Smart App Control, não altere a Execution Policy e não desbloqueie arquivos para contornar a recusa.
4. Se abrir, aguarde a IA ficar pronta nas configurações. O primeiro carregamento confere o modelo e usa CPU/RAM.
5. Escolha **Repavimentação — Asfalto**, na faixa de área correta da OS. Não informe chave ou conexão; essa versão trabalha offline.
6. Para facilitar as próximas aberturas, crie um atalho apontando para o EXE dessa pasta. Não mova o EXE sozinho para a Área de Trabalho.

O pacote atual usa CPU; não exige instalação de driver de GPU ou outro servidor. O desempenho no Latitude ainda não foi medido. Os 16 GB não garantem respostas em poucos segundos.

## 4. Conferir antes de usar casos reais

Comece com exemplos sintéticos, sem dados pessoais:

| Pergunta ou relato | O que conferir |
| --- | --- |
| “Sem foto antes.” | Não Conforme, com regra da etapa inicial |
| “Sem foto depois.” | Reprovado, com regra da etapa final |
| “Sem foto antes nem durante.” | Reprovado, com combinação das duas faltas |
| “Não tem aferição da vala.” | Pergunta sobre o tipo de equipe antes de decidir |
| Responder “interna” à pergunta anterior | Não Conforme e orientação de Retrabalho |
| Repetir o caso e responder “terceirizada” | Reprovado |

Use **Iniciar novo caso** antes de cada exemplo independente. Respostas curtas a uma pergunta do AEBOT continuam o mesmo caso. Confira também as regras utilizadas e a orientação; acertar só o rótulo não basta.

Meça separadamente a abertura, a primeira análise, cinco análises seguintes e um relato com várias falhas, com os sistemas de trabalho habituais abertos. Registre apenas o cenário sintético, tempo e erro observado. Na máquina de desenvolvimento, a primeira chamada à IA levou 19 segundos, além de 8 segundos para carregar; houve um pico de 83 segundos. Não prometo esses mesmos tempos no Latitude.

Se abrir corretamente, faça uma segunda conferência sem internet para confirmar o uso offline. Isso não altera a política de segurança. A aplicação não lê fotos automaticamente: o analista descreve as evidências.

## 5. Feedback, atualização e instalação definitiva

O chat fica só na memória e some ao fechar. Métricas técnicas, feedback enviado voluntariamente e regras importadas ficam no perfil local do usuário do Windows. Exporte pelas configurações quando precisar encaminhar ao responsável; o feedback local não aparece automaticamente no painel online legado.

Para atualizar, feche o AEBOT, copie outra pasta completa para uma pasta de versão nova e atualize o atalho. Não apague a anterior antes da conferência. Não há chave a cadastrar novamente. Revise qualquer aviso de pacote local de regras antes de começar outra OS.

A instalação empresarial definitiva usa **Setup assinado + GGUF na mesma pasta**, com os hashes e instruções do pacote correspondente. O Setup copia o modelo e cria os atalhos. Ainda falta a credencial/liberação de publicação; não use um Setup antigo como se fosse a 2.22.0. O caminho autorizado está em [Assinatura e liberação](ASSINATURA-E-LIBERACAO-WINDOWS.md).

Antes de ampliar para os analistas, preciso corrigir a divergência crítica, validar o gabarito, medir no Latitude e concluir o teste do executável final. O piloto deve ser supervisionado.

Projeto idealizado e conduzido por **Pedro Lucas Botelho**.
