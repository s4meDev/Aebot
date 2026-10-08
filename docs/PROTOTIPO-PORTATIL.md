# AEBOT portátil — teste supervisionado

Atualização de 08/10/2026. Preparei este perfil para testar o AEBOT por uma pasta completa, sem depender do VS Code, Node, chave de IA, servidor online ou instalador. É um protótipo, não uma entrega homologada para todos os analistas.

Versão 2.22.0, base 2.15.3, Qwen3-4B-Instruct-2507 Q4_K_M. O pacote inclui leitura preparada do catálogo de Asfalto; o analista não executa essa preparação. A comparação inicial reduziu a primeira análise de 154 para 15 segundos, além de 10 segundos para carregar o modelo. Relatos com conferência extra ainda demoram. Veja [as medições e divergências atuais](DESEMPENHO-IA-LOCAL.md); não há garantia de poucos segundos ou zero erros.

A pasta final desta revisão está em `desktop-release/prototipo-2.22.0-2026-10-08T18-52-43-897Z/win-unpacked`. Preservei a 2.21.0 e as preparações anteriores. **Não está validada para distribuição:** a tentativa de abrir o pacote 2.22.0 anterior desta revisão foi bloqueada pelo Controle de Aplicativo nesta máquina; a abertura do pacote final continua pendente. O build e os hashes passaram, mas isso não substitui abrir o executável e homologar o modelo. Não use o Setup antigo como se fosse esta versão.

O corpus completo passou em 48/49 casos; ainda há um relato de duas etapas ausentes retornando Não Conforme em vez de Reprovado. Na rodada final, a primeira chamada à IA levou 19,1 s, com outros 8,3 s para carregar o modelo; um caso chegou a 83 s. O teste separado de desenvolvimento pela interface e IPC passou em 20,8 s. Não anuncio essa versão como pronta para uso sem supervisão.

## Para quem vai testar

Para o notebook da empresa, siga [o passo a passo específico do Latitude](INSTALAR-NO-LATITUDE.md), incluindo os exemplos de conferência e o que fazer se o Windows bloquear.

1. Receba a **pasta inteira** preparada pelo responsável. Ela contém `AEBOT-Prototipo.exe`, `resources`, o modelo e as bibliotecas. Não copie somente o EXE.
2. Copie para uma pasta local do notebook Windows x64 com espaço livre suficiente (reserve pelo menos 5 GB). Evite executar dentro de arquivo compactado ou em pasta disponível apenas na nuvem.
3. Abra `AEBOT-Prototipo.exe`. Não exige instalação com administrador. Se quiser, crie um atalho para esse arquivo na Área de Trabalho.
4. Aguarde o estado da IA. Escolha **Repavimentação — Asfalto** no tamanho correspondente à OS e descreva as evidências com suas palavras.
5. Use **Iniciar novo caso** para outra OS. Uma resposta como “interna” continua a pergunta pendente do mesmo caso. Não misture ordens diferentes.
6. Confira a orientação antes de aplicar no sistema. Envie feedback pelo ícone do chat quando houver erro; não inclua dados pessoais desnecessários.

Depois do preparo, funciona sem internet. O modelo não cobra tokens nem tem cota de provedor; continua limitado pela CPU, memória, tempo e qualidade da interpretação. Não lê automaticamente as fotos, não acessa Field/SCAE e não executa alterações na OS.

Conversas ficam somente na memória e somem ao fechar. Métricas técnicas, regras importadas e feedback voluntário ficam no perfil local do Windows; exporte pelas configurações quando precisar encaminhar ao responsável. Para atualizar, receba outra pasta completa. A nova versão não exige recadastrar conexão ou chave.

## Se o Windows bloquear

O protótipo **não possui assinatura própria do AEBOT**. O runtime de IA tem assinatura de fornecedor; isso não assina o nosso código ou o EXE do aplicativo. A execução nesta máquina não garante aceitação em todos os notebooks da empresa.

Não desative Defender, Smart App Control ou políticas; não desbloqueie arquivos para contornar uma recusa. Guarde a mensagem e peça suporte. O pacote empresarial assinado continua separado e depende de uma credencial confiável de publicação. Veja [assinatura e liberação](ASSINATURA-E-LIBERACAO-WINDOWS.md).

O procedimento AUTOFORMS enviado descreve extração, executável e atalho. A etapa que chama de desativação do Defender mostra, na verdade, uma opção de desbloqueio nas propriedades. Não repliquei essa etapa: ela não comprova que a política de segurança aceitará o AEBOT.

## Para preparar outra versão no workspace

```powershell
npm.cmd ci
npm.cmd run desktop:assets
npm.cmd run desktop:catalog:prepare -- --service=repavimentacao-asfalto-ate-1m2
npm.cmd test
npm.cmd run typecheck
npm.cmd run desktop:evaluate -- --corpus=asfalto --prepared
npm.cmd run desktop:smoke -- --aebot-smoke-visual
npm.cmd run desktop:prototype
```

O último comando cria uma pasta nova em `desktop-release/prototipo-<versão>-<data>/win-unpacked`. Ela é a distribuição portátil completa, com instruções e hashes. Não substitui, apaga ou reempacota o Setup anterior. O `prototype-manifest.json` registra explicitamente que a assinatura do código AEBOT e o aceite operacional estão pendentes.

`desktop:package` continua gerando apenas a rota empresarial com assinatura obrigatória. Não confunda essa rota com `desktop:prototype` nem distribua os modelos candidatos: só o selecionado em `assets-lock.json` entra na pasta.

O mantenedor pode conferir o EXE final com `& '<pasta completa>\AEBOT-Prototipo.exe' --aebot-package-check`, executando na raiz do workspace. Esse modo usa um perfil temporário separado, carrega o GGUF real e testa a ponte/interface com perguntas sintéticas, incluindo uma primeira paráfrase real e suas regras. Salva `desktop-release/packaged-smoke.json` e encerra o runtime. Um caso aprovado não homologa o modelo, e esse modo não altera o perfil do analista. Não é o modo normal de uso.

## Critério para iniciar o piloto

Comece com poucos analistas, casos conhecidos e conferência humana. Compare conclusão, regra usada, orientação e tempo no Latitude de 16 GB. Registre falhas de linguagem e contexto; aprovação nos testes de código não prova compreensão de qualquer relato. Só amplie depois de revisar o gabarito e os resultados reais.

Projeto idealizado e conduzido por **Pedro Lucas Botelho**.
