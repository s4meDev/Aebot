# AEBOT 2.22.1 — protótipo offline para teste supervisionado

## Correções

- Duas faltas ligadas por “nem” recebem citações independentes, sem perder a negação nem inventar palavras.
- A conferência recebe a descrição da regra indicada, além do catálogo completo. Não escolhe agregadoras ou conclusões livremente.
- “Vejo o resultado pronto” e “não vejo o resultado” deixam de ter a mesma interpretação de presença/ausência.
- Mantive os critérios esperados e ampliei o corpus de Asfalto de 49 para 51 casos.
- Atualizei o empacotamento para a opção atual do compilador, removendo o aviso de `inlineDynamicImports`.
- Adicionei entrega ZIP64 com hashes, partes de 1 GiB e montagem que não executa o AEBOT nem altera o Windows.

A base continua 2.15.3. Não alterei conclusões de negócio para acomodar o modelo. O aplicativo mantém Qwen3-4B-Instruct-2507 local, runtime privado e ausência de fallback de nuvem.

## Baixar e usar

1. Nos arquivos do pré-lançamento, baixe todas as partes `AEBOT-2.22.1.zip.001`, `.002` e demais partes listadas, mais `JUNTAR-PACOTE.cmd` e `LEIA-PRIMEIRO.txt`. Não escolha apenas o “Source code”: ele não contém o modelo nem o executável.
2. Coloque os arquivos na mesma pasta e abra `JUNTAR-PACOTE.cmd`. Ele confere as partes, junta o ZIP e verifica o resultado. Se bloquear, pare e solicite suporte autorizado.
3. Extraia o ZIP pelo Explorador. Reserve pelo menos 12 GB durante montagem e extração.
4. Copie a pasta completa para o local permitido no Latitude e abra `AEBOT-Prototipo.exe`. Não precisa de Node, VS Code, chave ou servidor. Não mova somente o EXE.
5. Comece por Repavimentação Asfalto, com casos conhecidos e conferência humana. Use “Iniciar novo caso” para outra OS.

O [guia do Latitude](https://github.com/s4meDev/Aebot/blob/main/docs/INSTALAR-NO-LATITUDE.md) traz exemplos e conferências. O arquivo `SHA256SUMS-DOWNLOAD.txt` permite conferir a integridade. Hash não substitui assinatura de publicador nem homologação.

## Limites

Este é um pré-lançamento de protótipo, não a instalação empresarial homologada. O AEBOT ainda não tem assinatura própria; o runtime tem assinatura de fornecedor. Uma política de Controle de Aplicativo bloqueou também o EXE final desta revisão, antes de iniciar o teste empacotado. A interface/IPC em desenvolvimento passou com IA real, mas isso não valida o EXE bloqueado. Não posso garantir abertura no Latitude e não alterei proteções para fazer funcionar.

O sistema não lê fotos automaticamente, não acessa Field/SCAE e não modifica a OS. Conversas ficam apenas na memória. Feedback e métricas são locais e precisam ser exportados explicitamente.

A latência de múltiplos fatos continua alta na máquina de desenvolvimento de 8 GB. Não prometo poucos segundos nem zero erros em relatos imprevisíveis. A instalação, os tempos no Latitude e a revisão operacional do gabarito ainda dependem do piloto.

## Validação

Os 51 casos de Asfalto passaram com inferência real e conferência das regras aplicadas. Também passaram 829 testes regulares, o teste separado de 3.000 avaliações, TypeScript, auditoria e builds desktop/extensão/Node/Worker dry-run. Mediana dos casos com IA: 17,7 s; máximo: 78,8 s; carregamento separado: 10,6 s na máquina de 8 GB. Os resultados e a versão exata da rodada estão em [Desempenho local](https://github.com/s4meDev/Aebot/blob/main/docs/DESEMPENHO-IA-LOCAL.md). Teste aprovado não equivale a aceite dos analistas ou garantia de poucos segundos.

Projeto idealizado e conduzido por **Pedro Lucas Botelho**.
