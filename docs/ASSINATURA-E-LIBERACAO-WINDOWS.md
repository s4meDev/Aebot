# Assinatura e liberação do AEBOT no Windows

## Situação atual — 01/10/2026

Resolvi a execução local usando a [distribuição Unsloth do llama.cpp b11160-mix-a6922cc](https://github.com/unslothai/llama.cpp/releases/tag/b11160-mix-a6922cc), Windows x64 CPU. O ZIP foi conferido pelo SHA-256 `f657b4ec554ce2c03a82b615f0e4821c10aea7c7281e46a3f09dbfcd65263123`. Os 52 EXEs/DLLs apresentaram assinatura Authenticode válida: Unsloth AI Inc., com a biblioteca OpenMP assinada pela Microsoft. O comando de versão respondeu e o Qwen executou 12 casos com as proteções mantidas.

O lock seleciona `runtime-b11160-mix-a6922cc`, instalada ao lado da pasta antiga, preservada. O pacote inclui somente a versão selecionada. O preparo confere o ZIP, extrai com o tar do Windows e recusa inventário alterado; a licença MIT vem do ZIP verificado.

A assinatura do fornecedor resolve a confiança desses binários. O executável AEBOT e o novo Setup ainda precisam do certificado do publicador. A geração completa com esse certificado e a verificação PowerShell autorizada continuam pendentes. Os resultados da IA estão no [relatório atual](STATUS-DESKTOP-2026-10-01.md).

## Histórico do bloqueio em 29/09/2026

O Windows impediu `llama-server.exe` de carregar `ggml-base.dll`. A DLL está sem assinatura digital e o log Code Integrity registrou o bloqueio no evento 3077, acompanhado do 3033. O Smart App Control estava habilitado. A mensagem exibiu `0xC0E90002`.

Os arquivos tinham passado na conferência de SHA-256. Isso não contradiz o bloqueio: integridade comprova que os bytes conferem com a referência; assinatura identifica o publicador, e a política do Windows decide se pode executar. A Microsoft descreve o evento 3077 como bloqueio efetivo por política em [App Control events](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/operations/event-id-explanations).

Não é uma falha nas regras ou no modelo GGUF. Reinstalar o mesmo runtime sem assinatura não resolve essa exigência de confiança. Também não se deve desativar o Smart App Control, o antivírus ou alterar a Execution Policy para contornar o problema. O Smart App Control não oferece uma exceção individual comum por aplicativo, conforme a [FAQ da Microsoft](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions).

## Correção implementada no projeto

A configuração antiga usava `signAndEditExecutable: false`. Corrigi o empacotamento para:

1. Exigir assinatura com `forceCodeSigning: true`, sem produzir silenciosamente um pacote sem assinatura.
2. Habilitar assinatura do aplicativo e acrescentar `.dll` aos arquivos assinados. O builder instalado aplica esse fluxo também às cópias dos arquivos extras do runtime.
3. Conferir as assinaturas do runtime empacotado no hook `afterSign`, antes de montar o Setup. Consulta indisponível ou qualquer binário sem assinatura válida interrompe a etapa.
4. Recalcular o manifesto **somente da cópia assinada**, mantendo os hashes anteriores e posteriores em `signature-provenance.json`. Assinar altera o hash; os arquivos originais em `desktop-resources` não devem ser assinados ou ter seus hashes recalculados para esconder alterações.
5. Informar bloqueio de política na interface quando o processo devolve `0xC0E90002`, inclusive na representação numérica negativa do Windows.

A conferência exige assinaturas válidas em todos os EXEs e DLLs do inventário do runtime. É uma exigência conservadora do pacote AEBOT, não uma simulação exata da política de cada máquina: um arquivo sem assinatura pode funcionar por reputação em uma máquina e ser bloqueado em outra. Assinatura válida também não substitui o aceite da TI.

## O que ainda depende da TI ou do responsável pela publicação

Não encontrei certificado de assinatura de código válido com chave privada nos repositórios pessoais do usuário e da máquina. Isso não exclui um serviço de assinatura externo ou um certificado mantido pela empresa. Nenhum foi criado, comprado, importado ou usado nesta rodada.

É necessário definir quem publica e qual certificado ou serviço de assinatura será usado. Para compatibilidade com Smart App Control, a assinatura precisa ser de um emissor confiável; um certificado autoassinado inventado para o projeto não resolve essa confiança. Consulte [assinatura para Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control).

Não envie PFX, senha ou chave privada no chat nem coloque esses dados no Git. Configure a credencial no ambiente de publicação aprovado, por armazenamento seguro ou integração de assinatura definida pela TI. A configuração do projeto não contém uma credencial pronta e não escolhe um certificado empresarial por conta própria.

O verificador usa um script PowerShell somente de leitura. A execução desse arquivo foi recusada pela política desta máquina, também fora do sandbox. Sua sintaxe e seus contratos foram testados, mas a execução completa aqui depende de autorização/assinatura do script conforme a política da TI. Não adicione `Bypass` ou `Unrestricted` ao comando.

## Diagnóstico sem abrir o runtime

```powershell
npm.cmd run desktop:doctor
```

O comando consulta assinatura de EXEs/DLLs, estado do Smart App Control e até dez registros de bloqueio relacionados ao runtime entre os 200 eventos recentes consultados. Não inicia a IA, altera políticas ou instala certificados. Imprime somente nomes dos binários, estado e datas; não exporta mensagens completas dos eventos, conversas ou credenciais.

Código de saída 1 indica pendência nas assinaturas ou falha da consulta. `unknown` não significa proteção desligada. Eventos são históricos e podem deixar de representar o estado atual após uma atualização; falta de evento também não prova que o runtime está liberado.

Se o comando informar consulta impedida, encaminhe à TI este documento e o erro da execução. O diagnóstico já confirmado nos logs locais não depende de desligar a proteção para ser observado.

## Preparar a próxima distribuição

Depois de definir a assinatura, a identidade do publicador e autorizar a verificação:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run desktop:build
npm.cmd run desktop:package
```

O fluxo confere os arquivos originais, copia e assina no diretório intermediário, verifica o runtime assinado e monta o instalador. Não altere manualmente `checksums.json` em `desktop-resources`. O GGUF não é um executável e continua com o hash oficial; ele não precisa de Authenticode.

Antes de distribuir, conferir no ambiente de publicação a assinatura do Setup, do aplicativo e das DLLs, os hashes do pacote e a identidade esperada do publicador. Instalar em uma máquina limpa com a proteção habilitada, testar sem internet e verificar startup, reinício, análise e atualização de regras. A assinatura e o hook ainda não foram validados de ponta a ponta com um certificado real neste workspace.

O Setup antigo, já existente em `desktop-release`, não ganha assinatura nem correções retroativamente. Não o entregue como se fosse um novo pacote aprovado.

## Resultado técnico da primeira correção, antes da troca do runtime

- 508 testes aprovados e 1 ignorado; 24 testes novos sobre assinatura, inventário, cópia empacotada e código de bloqueio.
- Configuração validada pelo schema do electron-builder instalado.
- Sintaxe do PowerShell conferida sem executar o script bloqueado.
- TypeScript e build desktop revisados na entrega.
- Smoke do Electron aprovado com perfil separado, sem iniciar o Qwen; build da extensão e validação Manifest V3 também aprovados.
- Diff revisado, sem erros de espaços. Nenhum commit ou deploy nesta rodada.
- Nenhuma proteção alterada, nenhum certificado usado e nenhum instalador novo gerado.

Esse registro corresponde à primeira correção do empacotamento. A distribuição assinada posteriormente permitiu retomar a inferência. A instalação empresarial e a qualidade da IA continuam sujeitas às validações descritas acima. Assinatura não homologa a inteligência da IA.
