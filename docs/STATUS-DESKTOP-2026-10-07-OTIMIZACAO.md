# Revisão de assinatura e desempenho — 07/10/2026

Aplicativo **2.19.0**, base **2.15.1**, Qwen3-4B Q4_K_M e runtime assinado Unsloth b11160-mix-a6922cc. Este documento complementa a [primeira etapa do protótipo de Asfalto](STATUS-DESKTOP-2026-10-07.md), sem apagar os resultados anteriores.

## O que corrigi

- Troquei o perfil padrão de interpretação local por JSON compacto: mapeamentos dos fatos realmente mencionados e orientação curta, sem gerar uma lista extensa de estados “não mencionado”. Todas as classificatórias atômicas do serviço continuam no catálogo; agregadoras não ficam à escolha da IA.
- Mantive a reconstrução de citações literais pelo backend e a validação de serviço, IDs, campos, condições e exceções. A interpretação nunca vira uma nova pergunta para buscar outras decisões.
- Corrigi relatos afirmativos que o modelo marcava como consulta ou hipótese. “Não enviaram a imagem final” afirma ausência; “ninguém consegue saber o tamanho” afirma uma limitação. Perguntas e hipóteses explícitas continuam protegidas, e evidência presente não vira falta.
- Corrigi a leitura de “se” reflexivo, como “não se consegue ver”, para não presumir uma condição imaginada.
- Na base 2.15.1, a regra de trena exige impedimento de conferir a medição relatado. Mencionar a ferramenta sozinha não basta, mesmo quando a IA escolher seu ID.
- Ajustei a reserva de memória do runtime: cache de atenção q8, flash attention, sem cache de slots antigos, contexto de 8.192 tokens abaixo de 12 GB e 16.384 nas demais máquinas. Não alterei os pesos, hashes ou assinaturas de origem.
- Corrigi o wrapper do avaliador, que não encaminhava a seleção do novo protocolo. O relatório agora informa protocolo e configuração do runtime. Um teste de contrato protege esse encaminhamento.
- Acrescentei preflight de assinatura. Sem configuração, `desktop:package` para antes de copiar arquivos ou gerar um Setup. Presença de configuração não comprova validade do certificado; a assinatura real e a conferência posterior ainda precisam passar.
- Atualizei o título da janela para AEBOT, os comentários relevantes, README, arquitetura, guias e Kanban. Mantive os créditos de Pedro Lucas Botelho.

## Inferência real: resultado atual

Rodada `desktop-release/evaluations/2026-10-07T20-29-54-797Z.json`, perfil `v15:compact:kv-q8:auto-context:direct`. Foram executados os três casos semânticos reservados do corpus de Asfalto, sem outro runtime AEBOT concorrente. A comparação verifica conclusão e IDs classificatórios, não apenas o rótulo final.

| Caso sintético | Conclusão esperada/obtida | Tempo |
| --- | --- | --- |
| Falta de imagem do resultado final, escrita em paráfrase | Reprovado; regra da evidência depois | 164,5 s |
| Mesmo trecho já executado e encerrado em outra OS | Reprovado; regra de duplicidade | 24,2 s |
| Trena usada, mas as imagens não permitem saber o tamanho | Reprovado; regra de trena impeditiva | 36,9 s |

Resultado: **3/3**, sem erro técnico, aprovação indevida ou reprovação esperada perdida nessa amostra. Foram reportados 8.599 tokens de entrada e 288 de saída, em três chamadas. Startup: 14,2 segundos; mediana das chamadas: 36,9 segundos. O maior tempo não foi descartado nem escondido entre respostas rápidas do motor.

Máquina: Ryzen 5 5600G, aproximadamente 8 GB de RAM física. Memória livre pontual: cerca de 4,7 GB antes e 508 MB depois do carregamento. São fotografias, não medição do pico nem diagnóstico comprovado da causa da latência. Não permitem prever o desempenho do Latitude 3420 de 16 GB.

### Experimentos anteriores, preservados

- A rodada v13 da primeira etapa passou 1/3. Continua documentada no relatório anterior.
- `2026-10-07T20-10-49-643Z.json`: três timeouts. O rótulo de cache indicava compacto, mas o wrapper ainda enviava o contrato anterior. Não considero essa rodada uma avaliação válida do protocolo compacto.
- `2026-10-07T20-21-52-294Z.json`: compacto realmente aplicado; o modelo apontou a regra correta de foto final, mas marcou consulta. A avaliação ficou sem decisão. Esse diagnóstico motivou a correção de intenção; não alterei a conclusão esperada para esconder a divergência.

## Validação do código e dos arquivos

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test` | 676 aprovados, 1 ignorado |
| `npm.cmd run typecheck` | Frontend, ferramentas, Node e Worker aprovados |
| `npm.cmd run desktop:smoke` | Typecheck desktop, build e Electron real aprovados; isolamento, IPC, catálogo, seleção de Asfalto e decisão no chat conferidos |
| `npm.cmd run build:all` | Extensão e Node aprovados; Worker compilado em dry-run |
| Repetição de `build:worker` fora do sandbox | Aprovada, sem erro de permissão do log; nenhuma publicação |
| `rules:audit` | Base 2.15.1: 36 serviços, 99 cadastros, sem aviso de governança |
| Validadores da extensão e Node | Manifest V3 2.19.0 aprovado; sem segredos incorporados no bundle Node |
| Conferência do pacote offline | SHA-256 do GGUF, inventário do runtime e licenças aprovados |
| `git diff --check` | Sem erro de whitespace; avisos LF/CRLF do Git no Windows |
| `desktop:package` | Interrompido por falta de credencial de assinatura; nenhum Setup novo gerado |

A validação encontrou uma declaração TypeScript ausente no teste do preflight; acrescentei o contrato `.d.mts` e repeti o build. O Electron e o arquivo de log do Wrangler não puderam executar/gravar normalmente dentro do sandbox; repeti as verificações fora dele, sem alterar políticas do Windows. Uma repetição dos testes também falhou antes da execução por `EPERM` ao renomear o cache temporário do sandbox; fora dele, a suíte passou novamente, com 676 aprovados e 1 ignorado. A checagem de tipos foi repetida e passou. O aviso preexistente do Vite sobre `inlineDynamicImports` permanece, sem impedir o build.

## O que a assinatura significa

É a identificação digital de quem publica o programa. A autorização para desenvolver não fornece essa credencial. O runtime do fornecedor já tem assinatura e executou a IA; isso não assina o aplicativo AEBOT ou o Setup.

Não encontrei certificado de assinatura de código com chave privada nos repositórios pessoais do usuário ou da máquina, nem configuração por variáveis de assinatura. Não li ou imprimi seus valores. O próximo requisito é a TI configurar certificado ou serviço confiável no ambiente de publicação. O pedido pronto está em [Assinatura e liberação](ASSINATURA-E-LIBERACAO-WINDOWS.md). Não envie PFX, senha ou chave privada pelo chat.

Não desativei Smart App Control, antivírus ou Execution Policy. Não criei certificado autoassinado para simular confiança. Não assinei ou alterei os binários originais do fornecedor. O Setup antigo 2.18.0 não recebeu estas correções e não deve ser distribuído como versão nova.

## Como testar e o que falta

O protótipo recompilado abre por `Abrir-AEBOT.cmd` neste workspace, com Electron, dependências e modelo já preparados. Abri a instância atualizada e conferi a janela “AEBOT — Assistente de Análise” e o runtime fixado em execução, sem iniciar dois modelos. Não é um novo EXE autônomo nem um pacote empresarial. Consulte [Protótipo de Asfalto](PROTOTIPO-ASFALTO.md).

Ainda falta:

1. Medir o perfil atual no Latitude, inclusive a primeira resposta, com os sistemas de trabalho abertos. A latência observada ainda não atende à meta inicial de 20 segundos do Kanban.
2. Executar o corpus completo com IA real, revisar a orientação em português e obter aceite operacional. Três casos aprovados e centenas de testes de código não homologam qualquer conversa.
3. Confirmar a divergência do TXT sobre aferição e quais critérios se aplicam a Bloco/Cerâmica. Preservei a exceção anterior das equipes internas até confirmação.
4. Configurar a assinatura confiável, gerar Setup 2.19.0 com GGUF ao lado e testar instalação offline em máquina limpa com as proteções habilitadas.
5. Fazer piloto supervisionado com 5–10 analistas antes de ampliar.

Não removi arquivos, acrescentei segredos, publiquei serviços ou fiz commit nesta rodada. As alterações permanecem no workspace. Não prometo que um novo instalador elimina falhas semânticas ou torna a IA instantânea.
