# Prontidão de Repavimentação Asfalto — 03/11/2026

> Histórico da versão 0.5.0 / base 2.19.0. A confirmação posterior do responsável resolveu o conflito de trena e está incorporada à versão 0.5.1 / base 2.20.0. Consulte [a atualização vigente](ATUALIZACAO-TRENA-2026-11-03.md). As medições abaixo continuam identificadas com a fonte anterior.

Versão Python 0.5.0. Base compartilhada 2.19.0, sem mudança de critério de negócio.

## Situação que encontrei

O aplicativo 0.4.0 já era portátil, offline e tinha chat, consulta às regras, diagrama e feedback voluntário. A fonte conserva 36 serviços e 100 regras; o perfil Python trabalha somente com as duas faixas de Asfalto e suas 37 regras/orientações aplicáveis.

Isso não significa que a IA conheça todas as situações possíveis. BGE é um relacionador de textos, não um modelo generativo como ChatGPT. Acertar combinações sintéticas não comprova a compreensão de todo relato informal, nem resolve uma regra contraditória.

## O que corrigi nesta revisão

- Separei novas ocorrências na mesma frase. Antes, “sem foto antes e acabamento mal feito” podia encerrar a análise depois da primeira correspondência.
- Impedi que um novo objeto herdasse “foto” da oração anterior. “Nem sinalização” continua com sua própria negação e seu objeto original.
- Passei a indicar se a regra corresponde a um fato, a uma consulta ou a um cenário hipotético. Uma citação não passa a ser ocorrência confirmada.
- Equipe e frente sozinhas deixaram de ser assunto suficiente para recuperar uma regra. Uma pergunta sobre o almoço da equipe não deve explicar falta de aferição.
- Acrescentei esclarecimento tipado, vinculado ao trecho e ao escopo que ficaram ambíguos. Uma retificação explícita substitui só esse ponto, preservando as demais evidências. O trecho descartado não continua como condição ou antecedente oculto.
- Corrigi limites dos conectivos: “massa” não é uma continuação só porque começa com “mas”.
- Reaproveito comparações semânticas iguais somente no caso atual, em cache limitado e só em RAM. Novo caso limpa tudo. Não removi candidatos ou condições para ganhar velocidade.
- Acrescentei cobertura por regra à auditoria sintética. Conto separadamente fatos, consultas e hipóteses; muitos testes repetindo as mesmas regras não escondem critérios sem cobertura.

## O que preciso para fechar a validação operacional

1. **Confirmar um conflito de critério:** equipe interna sem aferição gera Não Conforme + Retrabalho pela orientação geral; a regra específica de trena que impede a conferência prevê Reprovado. Mantive ambas sem decidir pelo responsável. A pergunta de confirmação foi enviada no chat.
2. **Validar um gabarito de relatos reais anonimizados**, incluindo casos difíceis, exceções e correções. Feedback continua voluntário: não salvo conversas automaticamente nem transformo relato em regra sem revisão.
3. **Medir a entrega no Latitude**, com os aplicativos usuais abertos. O tempo de desenvolvimento não é garantia de tempo em outro equipamento.
4. **Conferir a distribuição na máquina de destino.** O AEBOT continua sem assinatura própria. Não altero controles do Windows para fazê-lo executar.

O TXT original não está mais nos Downloads conhecidos desta máquina. Trabalhei com os cadastros já identificados com a fonte e as orientações do responsável. Para conferir se nenhuma linha do material foi omitida no cadastro anterior, preciso novamente do original — não vou anunciar uma comparação integral que não fiz.

## Validação desta entrega

Os relatórios só contêm cenários sintéticos, não dados dos analistas. O gabarito antigo não foi alterado. A rodada intermediária detectou regressões em complementos temporais e em uma negação coordenada; corrigi e repeti os cenários afetados com modelo real, antes da rodada final.

| Verificação | Resultado |
| --- | --- |
| Python unittest | 101 aprovados. Inclui 1.024 combinações explícitas dentro de um teste parametrizado, fontes, contexto, retificações, cache, perfil e feedback. Não são 101 OS reais. |
| Auditoria final, modelo real | 1.274/1.278 cenários no critério completo; 1.277/1.278 nas decisões esperadas. |
| Novos cenários de prontidão | 26/26 aprovados com modelo real; oito casos complementares de orientações compartilhadas também passaram. |
| Cobertura do catálogo | 37/37 regras/orientações encontradas; nenhuma classificatória ficou sem caso afirmativo sintético. Isso não mede todas as combinações possíveis de linguagem. |
| Decisão oficial indevida | 0 na amostra final. Houve uma abstenção onde o gabarito esperava decisão. |
| Falha técnica na auditoria final | 0. Falha técnica não conta como acerto, mesmo retornando null. |
| Corpus independente anterior | 52/53 no critério completo, com a divergência de citação descrita abaixo; 53/53 conclusões esperadas. |
| Semânticos adicionais | 16/16 conclusões esperadas com modelo real, rede bloqueada no teste e independência do score por par conferida. |
| Janela com modelo real | Aprovada em três tamanhos, inclusive 580×500. Inclui a nova conversa com esclarecimento, seleção dos dois serviços, Novo caso, consulta à base e feedback voluntário sem anexar chat. |
| Legado | Vitest 875 aprovados e um ignorado; typecheck e build aprovados. |

Relatório final: `python/artifacts/full-050-final-2026-11-03.json`, com hashes da fonte realmente executada. As rodadas anteriores ficam como histórico de diagnóstico, não identificam a fonte final. Esses arquivos não entram no pacote dos analistas.

### Tempos, separados por caminho

Máquina de desenvolvimento: Windows 11, 12 processadores lógicos e 7,87 GiB de RAM física. A análise foi testada sem rede. Cache é limpo entre casos e pode ser reaproveitado apenas nas continuações do mesmo caso.

| Caminho por mensagem | Média | P95 | Máximo |
| --- | --- | --- | --- |
| Sem chamada ao BGE — 1.236 mensagens | 6,14 ms | 10,88 ms | 22,37 ms |
| Com chamada real ao BGE — 85 mensagens | 1,17 s | 2,33 s | 2,91 s |

Carregar e conferir o motor levou 3,19 s, separado da análise. O tempo da primeira abertura inclui esse preparo; não devo anunciar 1,17 s como o tempo total de abrir o aplicativo e obter qualquer resposta. Não é comparação controlada com o Latitude nem promessa de velocidade universal.

### Quatro divergências mantidas visíveis

1. Uma consulta sobre duplicidade cita a regra, sem classificar a OS; o gabarito antigo esperava nenhum ID classificatório. Agora a citação está marcada como `application: consultation`, mas mantive o critério antigo e sua divergência.
2. “tem o começo e o pronto, só não tem o pessoal fazendo o serviço” ainda pede esclarecimento. O gabarito espera Não Conforme por ausência de foto durante. Não infiro um objeto de evidência que o relato não esclareceu com segurança.
3. “Quero entender o desfecho que ninguém deixou ver” não recupera com segurança a regra de foto final. Há uma falha em cada faixa de Asfalto. A resposta faz uma pergunta, mas isso não transforma o teste de recuperação em acerto.

A rodada final não demonstrou queda de desempenho nos cinco cenários afetados pela regressão intermediária; eles voltaram às decisões e fundamentos esperados. Também não usei a melhora em casos novos para apagar essas quatro divergências antigas.

### Janela e executável

Gerei o aplicativo 0.5.0 com PyInstaller em estágio novo, preservando a entrega 0.4.0. O diagnóstico da fonte e três execuções do EXE passaram com modelo real, dois serviços, conferência da interface e feedback sintético em banco temporário. Executei os diagnósticos fora do sandbox por causa do bloqueio conhecido da pasta temporária desse ambiente; isso não muda as proteções do Windows nem usa o banco do analista.

A assinatura própria continua ausente (`NotSigned`). O pacote leva modelo, runtime, catálogo, logo e guias, sem conversas, credenciais, banco de feedback ou métricas de uso. O ZIP é conferido por manifesto SHA-256 e CRC. Hashes não substituem assinatura ou homologação.

Não troquei os pesos do BGE nem instalei outro modelo para anunciar inteligência maior sem medição. O ganho desta revisão está no fluxo de interpretação, nas proteções de contexto e na cobertura dos testes. Para uma conversa gerativa equivalente ao ChatGPT, ainda seria necessário avaliar uma camada gerativa local separada; ela não está implementada e não é garantia de acerto ou de latência.

## Meta realista de aceite

Busco nenhuma decisão oficial indevida na amostra validada, fundamentos corretos, perguntas úteis quando faltar contexto e respostas rápidas medidas no equipamento-alvo. Não prometo 100% de acerto em linguagem livre ilimitada. Uma abstenção ou falha técnica não conta como análise correta só porque retornou `null`.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
