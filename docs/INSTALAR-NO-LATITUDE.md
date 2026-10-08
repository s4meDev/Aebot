# AEBOT no Latitude — passo a passo para teste

## O que estou entregando agora

A versão 2.22.1 é um **protótipo portátil**, não um Setup empresarial homologado. Ela já leva o aplicativo, o modelo local e o runtime. O Latitude não precisa de VS Code, Node, chave de API, URL ou servidor online.

A revisão corrige a confusão de duas faltas coordenadas e de “vejo o resultado” com ausência final. Use com conferência humana; não tome a resposta como aprovação automática da OS. O resultado completo está em [Desempenho local](DESEMPENHO-IA-LOCAL.md). Acerto no corpus sintético não homologa qualquer pergunta.

As tentativas de abrir os EXEs 2.22.0 e 2.22.1 nesta máquina foram bloqueadas pelo Controle de Aplicativo do Windows. Não posso garantir que abra no Latitude. Assinatura/liberação e qualidade da análise são etapas diferentes: liberar o EXE não corrige nem acelera o modelo.

## 1. Levar a pasta certa

Se receber os arquivos de download em partes:

Use os arquivos do [pré-lançamento 2.22.1](https://github.com/s4meDev/Aebot/releases/tag/v2.22.1-prototipo). O “Source code” não inclui o executável ou o modelo.

1. Baixe todas as partes `AEBOT-2.22.1.zip.001`, `.002` e demais partes listadas na entrega, junto com `JUNTAR-PACOTE.cmd`, para a mesma pasta. Não renomeie os arquivos.
2. Abra `JUNTAR-PACOTE.cmd`. Ele confere as partes, junta o ZIP e verifica seu SHA-256. Não inicia o AEBOT nem altera proteções. Se o comando for bloqueado, pare e solicite suporte.
3. Extraia `AEBOT-2.22.1.zip` pelo Explorador de Arquivos. Reserve pelo menos 12 GB durante a montagem/extração. Depois da conferência, a pasta completa é o portátil; não execute pela visualização interna do ZIP.

O pacote é dividido porque cada arquivo de release do GitHub deve ter menos de 2 GiB, conforme a [documentação oficial](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases). As partes são do mesmo ZIP; o montador usa apenas ferramentas do Windows. Hash não substitui assinatura ou liberação da empresa.

No computador de desenvolvimento, a pasta final está em:

```text
desktop-release\prototipo-2.22.1-2026-10-08T19-49-16-448Z\win-unpacked
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
3. Se esse local for permitido pela empresa, crie `AEBOT-Prototipo` e, dentro dela, `2.22.1`. Se houver um local corporativo definido, use esse local.
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

Meça separadamente a abertura, a primeira análise, cinco análises seguintes e um relato com várias falhas, com os sistemas de trabalho habituais abertos. Registre apenas o cenário sintético, tempo e erro observado. Na rodada 2.22.1 de desenvolvimento, o carregamento levou 10,6 segundos; a mediana dos casos com IA foi 17,7 segundos e o máximo 78,8 segundos. Não prometo esses mesmos tempos no Latitude.

Se abrir corretamente, faça uma segunda conferência sem internet para confirmar o uso offline. Isso não altera a política de segurança. A aplicação não lê fotos automaticamente: o analista descreve as evidências.

## 5. Feedback, atualização e instalação definitiva

O chat fica só na memória e some ao fechar. Métricas técnicas, feedback enviado voluntariamente e regras importadas ficam no perfil local do usuário do Windows. Exporte pelas configurações quando precisar encaminhar ao responsável; o feedback local não aparece automaticamente no painel online legado.

Para atualizar, feche o AEBOT, copie outra pasta completa para uma pasta de versão nova e atualize o atalho. Não apague a anterior antes da conferência. Não há chave a cadastrar novamente. Revise qualquer aviso de pacote local de regras antes de começar outra OS.

A instalação empresarial definitiva usa **Setup assinado + GGUF na mesma pasta**, com os hashes e instruções do pacote correspondente. O Setup copia o modelo e cria os atalhos. Ainda falta a credencial/liberação de publicação; não use um Setup antigo como se fosse a 2.22.1. O caminho autorizado está em [Assinatura e liberação](ASSINATURA-E-LIBERACAO-WINDOWS.md).

O relato crítico passou após a correção, junto dos 51 casos. Antes de ampliar para os analistas, preciso validar o gabarito com o responsável, medir no Latitude e concluir a execução autorizada do pacote final. O piloto deve ser supervisionado.

Projeto idealizado e conduzido por **Pedro Lucas Botelho**.
