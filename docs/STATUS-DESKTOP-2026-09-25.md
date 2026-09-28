# Revisão do desktop e documentação em 25 de setembro

## Entrega desta etapa

O README agora distingue claramente execução no VS Code, instalação Windows e extensão Chrome legada. Os créditos de Pedro Lucas Botelho permanecem no final. O novo [guia de execução](EXECUTAR-E-TESTAR.md) reúne preparação, comandos, testes, distribuição, atualização de regras e problemas comuns. O [plano de validação](PLANO-DE-VALIDACAO-DESKTOP.md) separa implementação concluída de homologação pendente.

Na primeira etapa desta revisão, o Kanban em Word ainda não havia sido recebido. Após o envio, os três documentos foram lidos e a comparação foi registrada em [KANBAN.md](KANBAN.md). Esse adendo não altera os resultados técnicos abaixo nem transforma implementação em homologação.

## Correções e comentários no código

- A validação semântica usa os mesmos verbos nas formas positiva e negativa. Assim, reconhecer “não aparece” não deixa “aparece” passar como uma ausência inventada pelo modelo.
- Consultas e hipóteses explícitas são preservadas pelo classificador de intenção antes de aceitar o mapeamento semântico. O modelo não pode converter “Precisa mesmo de foto antes de começar?” em falta afirmada.
- O consumo de tokens informado pelo runtime é preservado mesmo quando o texto gerado não é JSON válido.
- Comentários explicam a proteção contra inicializações antigas do runtime, uma análise por vez, interpretação das métricas e os limites entre interpretação e decisão.
- O avaliador registra configuração de hardware sem identidade pessoal, versões, hashes, inicialização e resumo de erros/latências. Casos com chamadas à IA são medidos separadamente dos casos sem chamadas.

Nenhuma regra de negócio ou conclusão oficial foi criada nesta etapa. As correções são genéricas e compartilhadas pelos perfis de execução.

## Resultado observado com o Qwen

A primeira rodada desta revisão usou `--offset=72 --limit=6 --thinking`, ainda sem as duas correções semânticas. Ela terminou com 4/6 resultados esperados. As divergências foram as duas frases acima, classificadas indevidamente como Não Conforme em vez de permanecerem sem decisão oficial.

Os quatro casos que chamaram a IA levaram entre aproximadamente 98 e 155 segundos; os dois determinísticos levaram 6 ms cada. A máquina de teste é um Ryzen 5 5600G com cerca de 8 GB de RAM, com pouca memória livre após carregar o modelo. Ela não representa o Latitude de 16 GB e a sessão de desenvolvimento não é um ensaio controlado de desempenho.

O registro dessa rodada está em `desktop-release/evaluations/2026-09-25T11-22-43-572Z.json`. Ele deve ser preservado como evidência anterior às correções, não como resultado do código final.

As proteções foram testadas com respostas simuladas incorretas do modelo, inclusive no fluxo completo de análise. Depois, a repetição dos seis casos no **perfil padrão direto** terminou com 6/6 resultados esperados, sem erros de transporte/contrato nas quatro chamadas ao modelo. As duas frases que divergiam não geraram conclusão oficial indevida. Isso confirma a amostra, não a qualidade geral do Qwen.

Os quatro casos com IA levaram 54.084, 35.240, 25.044 e 29.622 ms; os outros dois, 5 e 3 ms. A mediana dos casos com chamada ao modelo foi 32.431 ms. Os perfis e as condições de carga diferem da primeira rodada: não atribua a diferença de tempo somente à correção do código.

Relatório após as correções: `desktop-release/evaluations/2026-09-25T11-33-27-653Z.json`, com `completed: true`, `offset: 72` e perfil `direct`. O hash do avaliador compilado é `d41d3bf284e2755ce87bbde0fdab5fe25b9ddfc6f3ee1c40ff45889f0715cd33`. Decisão nula e status válido de modelo não garantem, isoladamente, que toda orientação em português foi útil.

## Validação e pendências

Após as correções, 413 testes automatizados passaram e 1 permaneceu ignorado. Esses testes verificam contratos e regressões, não homologam a IA.

Typecheck, builds da extensão e servidor Node, dry-run do Worker e validação do Manifest V3 passaram. A auditoria de regras confirmou 36 serviços e 77 regras, sem alterar a base; 8 serviços continuam com regras pendentes e 6 nomes aguardam confirmação.

O smoke do Electron passou com renderer isolado, ponte IPC, catálogo e decisão determinística. A captura de tela foi inspecionada. Os links locais dos guias foram conferidos. O build ainda informa a depreciação de `inlineDynamicImports`, sem falha de compilação.

O instalador 2.18.0 foi regenerado em 25/09 com as correções desta revisão. O empacotamento conferiu runtime, licenças e modelo, copiou o GGUF e atualizou `SHA256SUMS.txt` em `desktop-release`. Continua sendo um pacote de testes supervisionados, sem assinatura corporativa; não foi feita instalação/desinstalação em máquina limpa nesta etapa.

Continuam pendentes: gabarito operacional revisado, execução integral dos 100 casos, revisão da utilidade das respostas naturais, medição no Latitude, instalação em máquina limpa, assinatura/aprovação da TI e piloto supervisionado. O modo experimental não foi habilitado no aplicativo.
