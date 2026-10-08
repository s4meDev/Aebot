# Protótipo local — Repavimentação Asfalto

Atualização de 08/10/2026: aplicativo 2.22.1, base 2.15.3. Priorizei as duas opções de Asfalto do catálogo, usando as regras enviadas por Pedro Lucas Botelho em `Repavimentação Asfalto atualizado.txt`. O aplicativo usa o Qwen3-4B-Instruct-2507 local e pode restaurar a leitura preparada do catálogo, sem salvar conversas. Não envia o chat à nuvem. A revisão separa faltas coordenadas mantendo o “nem” e confere evidência vista versus ausente. Para testar fora do workspace, use a [pasta portátil completa](PROTOTIPO-PORTATIL.md), sem Node ou cadastro de chave.

## Abrir e testar neste computador

1. Na raiz do projeto, dê dois cliques em `Abrir-AEBOT.cmd`. Ele abre o aplicativo já compilado usando o executável Electron instalado no workspace.
2. No seletor, procure **Asfalto** e escolha Até 1m² ou Acima de 1m² conforme a OS.
3. Use um caso por conversa. Clique no ícone de reiniciar, identificado como **Iniciar novo caso**, antes de analisar outra OS.
4. Relate o que as evidências mostram. O AEBOT não lê as fotos da OS automaticamente nem consulta o Field/SCAE.

O atalho depende desta pasta, de `node_modules` e do build atual. Não é um novo instalador nem um EXE autônomo para enviar aos analistas. Se precisar recompilar, execute `npm.cmd run desktop:build`. Para abrir com recompilação automática, use `npm.cmd run desktop:start`.

O runtime/modelo já estão preparados aqui. Não instale o Setup antigo esperando encontrar estas regras: ele não foi atualizado. O protótipo portátil é um perfil separado, autorizado para teste sem assinatura própria; pode ser bloqueado em outro notebook. O pacote empresarial continua exigindo certificado confiável. Não desativei proteção do Windows ou Execution Policy.

## Exemplos iniciais

| Escreva | Orientação esperada |
| --- | --- |
| Sem foto antes. | Não Conforme por Qualidade Fotográfica |
| Sem foto antes nem durante. | Reprovado; as duas ausências sustentam a combinação |
| Sem foto depois. | Reprovado por não evidenciar a execução |
| Não tem OS de origem. | Não Conforme; conferir Field/SCAE e troca para 318033 |
| A medição é incoerente. | Não Conforme; conferir metragem comprovada |
| A trena impede verificar a metragem. | Reprovado; simples menção de trena não basta |
| Fez concreto na OS de asfalto. | Reprovado por deveria ter encerrado como Exoc |
| Duplicidade confirmada no Field. | Reprovado com orientação de cancelamento |
| Faltou adicional posterior necessário. | Não Conforme por falta de parametrização |
| Sem aferição da vala. | Perguntar o tipo de equipe, enquanto a exceção anterior estiver vigente |

Para a última pergunta, responder **interna** continua o caso e orienta Não Conforme + Retrabalho. **Terceirizada** orienta Reprovado. Uma reprovação realmente aplicável prevalece sobre não conformidades no Asfalto; essa prioridade não torna uma regra apenas relacionada aplicável.

Não basta escrever “ok” para receber Conforme. A base exige declaração de conferência de todos os critérios aplicáveis sem irregularidades. Essa declaração depende da conferência humana; uma falha relatada continua prevalecendo. As únicas conclusões são Conforme, Não Conforme e Reprovado. Cancelamento e Retrabalho são ações operacionais, nunca novas conclusões.

## O que precisa de confirmação

- O TXT diz Reprovado sem aferição; a regra anterior distingue internas e terceirizadas. Até confirmação do responsável, preservei a exceção das internas.
- O TXT menciona aproveitamento de algumas regras em Bloco/Paralelo e Cerâmica, mas não indica quais. Não apliquei automaticamente todas, nem levei as regras novas para Calçada simples.
- O código 318033 foi registrado como orientação, sem inventar nome ou parametrização de um serviço ainda não identificado no catálogo.
- Para aferição da origem, a base pede a frente quando ausente, distingue Manutenção/Comercial e a exceção VCG. Isso não dispensa conferir a aferição do serviço atual. Relatos que misturem falhas da origem e do serviço atual exigem cuidado: não tratamos a conversa como integração automática com as OS.

## Manutenção e testes

As regras estão somente em `src/data/rulesStore.json`, versão **2.15.3**. Os 22 cadastros `RULE-ASF-*` são compartilhados entre os dois tamanhos. As regras gerais já existentes de adicionais e aferição continuam reutilizadas. A regra de trena exige também um impedimento de conferir a medição relatado; citar a ferramenta sozinha não basta. Excesso de desdobro exige contexto de adicional/serviço extra na OS; outra ordem encerrada, sozinha, não comprova isso.

`decisionPolicy: most_severe_applicable` é um campo validado do serviço. Sua ausência mantém o ranking anterior. Não há ramificação “se for Asfalto” no motor.

`src/data/asphaltPilotCases.json` contém 51 cenários sintéticos: 35 casos básicos e 16 reservados à avaliação da IA/conversa. Alguns casos básicos também chamam o modelo; não anuncie 51 inferências. Conferem evidência presente, ausência negada, dupla negação, perguntas, etapas combinadas, duas novas variações de faltas coordenadas e continuação com equipe interna/terceirizada. Os testes unitários não fingem que o matching lexical resolve as paráfrases. O avaliador verifica também IDs classificatórios e falhas técnicas, além da conclusão; isso ainda não substitui a revisão operacional de fatos e orientação.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run desktop:smoke
npm.cmd run desktop:catalog:prepare -- --service=repavimentacao-asfalto-ate-1m2
npm.cmd run desktop:evaluate -- --corpus=asfalto --prepared --inspect-facts
```

O smoke confere IPC, isolamento e combinação de fotos no serviço certo, sem carregar o Qwen. A avaliação real carrega o Qwen, registra a rodada desde o início e salva resultados em `desktop-release/evaluations`. Diagnósticos são exclusivos do corpus sintético; conversas dos analistas não são persistidas.

O perfil local atual usa JSON curto, IDs reais de regras, cache de atenção q8 e contexto ajustado à RAM: 8.192 tokens abaixo de 12 GB, 16.384 a partir disso. Restaura o catálogo público compatível, sem salvar perguntas. O analista não configura esses parâmetros. Compare os resultados atuais e históricos em [desempenho local](DESEMPENHO-IA-LOCAL.md); latência e qualidade ainda precisam de homologação.

Este é um protótipo para avaliação supervisionada, não uma homologação. O perfil portátil permite o teste sem assinatura própria, quando a política da máquina aceitar. Antes da distribuição ampla: ampliar a avaliação da IA, medir no Latitude, concluir a rota empresarial e testar instalação offline em máquina limpa.
