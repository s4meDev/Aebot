# Entrega para testes — 16/11/2026

Preparada em 15/11/2026 por **Pedro Lucas Botelho Naus**.

## O que entrego

Um ZIP de primeira instalação, **AEBOT-Instalar-0.9.1-Testes-16-11-2026.zip**, com instalador offline, pacote completo assinado e manuais. A análise continua no aplicativo 0.9.1, com BGE/ONNX local, duas faixas de Repavimentação Asfalto e base 2.20.0. Não alterei o modelo, a regra de negócio ou o gabarito para preparar esta distribuição.

O instalador confere a identidade incorporada da entrega (nome, tamanho, SHA-256 e versão), a assinatura e os arquivos do pacote. Prepara o destino separadamente e roda `AEBOT.exe --check` antes de disponibilizar a instalação. A tela fica responsiva, impede duas instalações simultâneas e só libera Abrir após sucesso. Destino existente é recusado, não sobrescrito. Preparações interrompidas são preservadas, não limpas automaticamente.

O destino padrão fica no usuário Windows: `%LOCALAPPDATA%\AEBOT\Application`. Não há instalação de serviço, inicialização automática, mudança de política ou download de componentes. A central SharePoint/OneDrive continua sendo uma opção futura para atualizações depois da publicação; não é requisito para instalar este ZIP. Não conectei o ChatGPT à conta corporativa e não alterei AutoForms.

## Conferências desta entrega

- O **novo EXE do instalador** realizou uma instalação completa em pasta de laboratório, com interface do instalador e diagnóstico do EXE instalado aprovados. O ensaio levou **47,54 segundos no total**, incluindo copiar, conferir e testar a IA; isso não é tempo de resposta a uma pergunta. Nenhuma instalação ou feedback real foi usado. Relatório: `python/artifacts/offline-installer-exe-2026-11-15.json`.
- Na **cópia efetivamente instalada**, os **100/100 casos** do documento/retificações e de consultas compostas passaram com modelo real, regras, decisões e comportamento conferidos, nas duas faixas. Nenhuma falha técnica. Rede bloqueada no ensaio. Relatório: `offline-rules-2026-11-15.json`.
- Os **16/16 casos semânticos adicionais** passaram com modelo real, rede bloqueada e independência entre pares. Relatório: `semantic-install-2026-11-15.json`.
- O corpus histórico permanece **52/53 no critério completo**, com a consulta de duplicidade já conhecida. Não alterei a expectativa para escondê-la. Relatório: `corpus-install-2026-11-15.json`.
- A interface principal passou novamente no teste de Tk com modelo real: envio, consulta, retificação, hipótese, equipe pendente, janelas menores, fundamentos e feedback voluntário sem chat.
- A tela do instalador passou em três tamanhos, com operação única, espera em thread e recuperação de falha. Não usei o perfil real nem abri o chat do usuário.
- **239 testes de unidade Python** passaram, incluindo os 14 novos controles de instalação e empacotamento. **878 testes do legado** passaram, com 1 ignorado; typecheck, build e validação Manifest V3 passaram. A primeira tentativa de Vitest no isolamento falhou por bloqueio da conexão local sintética; fora do isolamento, a suíte passou sem mudar código.

A auditoria completa anterior do mesmo motor preserva **1.554/1.556 cenários integrais**, com duas divergências históricas documentadas em `RESULTADOS-TESTES.md` na instalação. A rodada anterior não é apresentada como executada novamente hoje. Os hashes dos fontes auditados e a projeção do catálogo são conferidos antes de fechar a entrega. Nenhum falso “100% geral”: os 100 casos acima são um conjunto determinado, não toda a linguagem possível.

## Como começo amanhã

Envio o ZIP inteiro, extraio tudo e sigo **00-COMECE-AQUI.txt**. Instalo, abro e aguardo IA local pronta. Faço o **01-ROTEIRO-DE-TESTE.md** nas duas faixas antes de levar uma orientação para o sistema da empresa. Uso Novo caso para outra OS, retificação para corrigir informações e Ver fundamentos para conferir a base. O aplicativo não lê fotos nem altera ordens automaticamente.

Se encontrar problema, registro voluntariamente no formulário sem dados identificáveis e exporto JSON para reunir os relatos. A conversa não é salva e não há telemetria persistente. Atualização preserva feedback e usa pacote compatível; não extraio arquivos por cima da instalação.

## O que ainda depende do computador de destino

O AEBOT continua **sem certificado Authenticode próprio**. A assinatura Ed25519 do pacote protege a atualização, mas não garante que políticas corporativas permitam o EXE. Se houver bloqueio, guardo a mensagem; não desativo controles do Windows. O ensaio de hoje não foi no Latitude nem em todas as máquinas da empresa.

Desempenho e entendimento precisam ser observados nos relatos reais dos analistas. Não prometo acerto universal nem poucos segundos em toda abertura/pergunta. As ambiguidades conhecidas permanecem registradas; quando não há suporte suficiente, a orientação deve pedir esclarecimento e não inventar conclusão.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
