# Revisão do protótipo — 08/10/2026

Este relatório descreve a entrega 2.20.0. A etapa posterior 2.21.0, com novo pacote e medições de latência, está em [desempenho da IA local](DESEMPENHO-IA-LOCAL.md). Preservei os resultados abaixo como histórico.

Aplicativo 2.20.0, base 2.15.2. Mantive a rota offline por notebook e não publiquei alterações no Worker legado. A prioridade desta rodada é um protótipo portátil de Repavimentação Asfalto, com interface mais limpa e interpretação conferida por testes reais.

## O que implementei

- Perfil portátil separado: EXE, runtime, modelo, licenças, instruções e hashes em uma pasta nova. Não exige Node, chave ou URL do analista. Não enfraquece o Setup empresarial assinado.
- Interface preta/grafite, conversa central, contexto lateral em janela larga e seletor pesquisável. Sem fontes remotas, brilho ou bibliotecas visuais novas. A captura real revelou estilos legados conflitantes; corrigi o empilhamento e o corte dos nomes.
- Respostas atrasadas de outro serviço/base não entram no chat novo. A inferência já iniciada não é cancelada por essa proteção.
- Tempo real de espera visível, sem porcentagem ou barra fictícia. Retirei o aquecimento sintético prolongado do runtime; a primeira resposta continua sendo medida como fria.
- Pergunta de contexto conhecida, com correspondência forte e declarada nos dados, sai diretamente do motor local. “Sem aferição da vala” pergunta a equipe sem chamar a IA; “interna” resulta em Não Conforme + Retrabalho e “terceirizada” em Reprovado.
- Validação de polaridade ampliada para envio/visibilidade e inexistência declarada. Isso impede aceitar uma ocorrência que contradiz o relato, sem cadastrar regra de serviço no TypeScript.
- Candidatos com revisão, tamanho e SHA-256 fixos, avaliação separada e preservação dos modelos antigos. O analista não escolhe nem configura esses parâmetros.
- A base 2.15.2 exige contexto de adicional na regra de excesso de desdobro, para que uma frase sobre outra OS não sustente uma irregularidade de parametrização.
- A mesma revisão exige vínculo/origem relatado para ausência da OS de origem: negar duplicidade não significa que a origem está ausente. O avaliador distingue regras consultadas e efetivamente aplicadas nos casos negativos, mantendo ambas as listas e os relatórios anteriores.
- Conforme exige declaração de conferência completa e ausência de irregularidades no relato original. Um mapeamento do modelo sobre fotos presentes não substitui essas condições.
- Guias de execução, arquitetura e README atualizados, preservando os créditos de Pedro Lucas Botelho.

## Comparação de IA: evidência, não promessa

Ryzen 5 5600G, aproximadamente 8 GB de RAM, CPU, contexto 8.192, KV q8, JSON compacto. A máquina não é o Latitude de 16 GB do destino. As rodadas não são um benchmark controlado: memória livre, cache do sistema e outras tarefas variam. Não atribuí a latência apenas à RAM como causa comprovada.

| Modelo/perfil | Recorte | Resultado e tempos |
| --- | --- | --- |
| Qwen3-4B v15, 07/10 | 3 paráfrases de Asfalto | 3/3; 164,5 / 24,2 / 36,9 s |
| Qwen3-4B v17, 08/10 | mesmas 3 paráfrases | 2/3; primeira excedeu o limite (~184,5 s); seguintes 52,3 / 39,2 s |
| Qwen3.5-2B v17 | mesmas 3 paráfrases | 1/3; 33,0 / 25,9 / 29,6 s. Não selecionado |
| Qwen3.5-4B v17 | mesmas 3 paráfrases | 3/3; 71,5 / 65,4 / 67,7 s |
| Qwen3.5-4B v17 | presença, duplicidade negada e equipe | 0/4 pelo gabarito de conclusão + IDs. Uma duplicidade negada virou reprovação; resposta interna perdeu o contexto. Não aprovado com base nos três primeiros acertos |

Os problemas encontrados motivaram a guarda linguística e a devolutiva determinística descritas acima. As falhas ficam nos relatórios anteriores; não apaguei rodadas divergentes. O protocolo v18 identifica as novas proteções. Acertar um rótulo `null` por falha técnica não comprova interpretação correta; confira também tentativas, fatos, regras e orientação.

Selecionei Qwen3-4B-Instruct-2507 Q4_K_M para o protótipo: acertou as três paráfrases classificatórias em 105,5 / 26,3 / 38,9 s. A primeira continua lenta. A primeira rodada estendida encontrou contexto indevido de adicional (corrigido na base) e divergências nos casos negativos. Encontrou também um erro do avaliador: só repassava `followUpQuestion`, omitindo `advisory.missingInformation` usado pelo chat real. Corrigi esse contrato e acrescentei teste; não atribuí ao modelo as continuações avaliadas com estado errado. Essa seleção é provisória para piloto, não comprovação de superioridade em todos os serviços.

Na rodada final `2026-10-08T13-34-55-036Z.json`, os sete cenários passaram quanto à conclusão e às regras aplicadas: três paráfrases, presença, duplicidade negada e continuações de equipe. Inicialização 19,9 s; tempos 114,3 / 24,9 / 34,4 / 49,6 / 39,9 s nos cinco casos com modelo, e cerca de 5 ms nas duas continuações determinísticas. O modelo ainda propôs ausência de origem indevida no caso negativo; o motor bloqueou pela condição original. Portanto o sistema passou nesse recorte, não o raciocínio livre do modelo. A latência continua acima da meta.

As primeiras tentativas de carga de candidatos dentro do isolamento da ferramenta não conseguiram consultar saúde do runtime. As rodadas reais autorizadas fora desse isolamento iniciaram. Isso não exigiu mudar segurança ou Execution Policy do Windows; não declarei incompatibilidade de arquitetura a partir desses timeouts.

## Instalação e segurança

Li o conteúdo do procedimento AUTOFORMS, inclusive tabelas e imagens. Ele orienta pasta extraída, EXE e atalho, mas também apresenta desbloqueio nas propriedades sob um título de Defender. Usei a forma de pasta/atalho; não reproduzi desbloqueio ou desativação de proteção. O documento não comprova assinatura ausente nem políticas iguais às do AEBOT.

O protótipo não tem assinatura própria do AEBOT. As identidades dos fornecedores não assinam `app.asar`. A empresa pode bloquear a execução; não há promessa de dispensar suporte em qualquer notebook. O Setup empresarial permanece condicionado ao certificado confiável e à validação das assinaturas. Nenhuma credencial de assinatura ou IA entrou no pacote.

## O que ainda falta

- Confirmar desempenho e segurança no Latitude, instalação por cópia sem internet e permissões reais do ambiente corporativo.
- Revisar o gabarito com o responsável e conferir respostas/ações, não apenas conclusão e IDs. Ampliar para relatos ambíguos, múltiplos fatos e demais serviços.
- Definir qualidade e latência aceitáveis antes de liberar o piloto de 5–10 pessoas e, depois, escala. Não prometo inteligência equivalente a ChatGPT nem 100% de acerto.
- Confirmar a exceção de aferição para equipe interna perante o TXT de Asfalto e quais regras se estendem a Bloco/Cerâmica.
- Para distribuição empresarial permanente, concluir assinatura do aplicativo e teste em máquina limpa. O protótipo não substitui esse aceite.

Próximo passo operacional: levar a **pasta portátil inteira** ao Latitude, testar casos conhecidos com supervisão e devolver métricas/feedback pelo aplicativo. Guia em [protótipo portátil](PROTOTIPO-PORTATIL.md).

## Validações de código

695 testes passaram e 1 foi ignorado (teste de capacidade executado separadamente quando necessário). TypeScript e builds de extensão, servidor Node e Worker foram validados, sem publicação. O build desktop também passou. A interface real foi inspecionada em janela larga e de 420 px, incluindo abertura, chat e seletor; o smoke percorreu IPC, catálogo, isolamento e combinação de evidências. Essa conferência visual não homologa a IA.

## Pasta pronta e teste do EXE final

Distribuição completa: `desktop-release/prototipo-2.20.0-2026-10-08T13-41-30-225Z/win-unpacked`. Abra `AEBOT-Prototipo.exe`; copie a pasta inteira ao notebook. Modelo, runtime e hashes da cópia foram conferidos. O arquivo continua sem assinatura própria do AEBOT.

Executei o EXE final com `--aebot-package-check` acompanhado até seu encerramento: código 0. `desktop-release/packaged-smoke.json` registra `packaged: true`, `status: completed`, runtime `ready`, Qwen Instruct e base 2.15.2. Foram conferidos catálogo de 36 serviços, renderer sem Node, ponte IPC, seleção de Asfalto, resposta no chat e combinação antes/durante. O teste usa perfil temporário separado e encerrou o runtime. Não comprova instalação ou desempenho em outra máquina.

A primeira chamada do EXE pelo PowerShell retornou antes do teste GUI concluir; não a contei como sucesso. A repetição acompanhada pelo processo Node confirmou o resultado final. O `app.asar` foi inspecionado: 98 entradas, sem arquivos privados de ambiente, credenciais ou avaliador externo. A revisão de 204 arquivos do workspace não identificou padrões conhecidos de chave de API ou chave privada; essa busca não substitui revisão de segurança completa. Nenhum novo segredo foi adicionado.
