# Restauração e protótipo Python — 19/10/2026

## O que recuperei

A pasta local não estava disponível. Recuperei os arquivos versionados do repositório `s4meDev/Aebot`, branch `main`, a partir de `7796e009ccbc3b449c34059154db2c6add9186d7`. Isso não recupera arquivos ignorados, alterações que nunca foram commitadas, credenciais nem antigos modelos locais. Nenhum conteúdo existente foi sobrescrito durante o clone.

O TXT original de Asfalto não foi localizado nesta máquina. Suas regras e referências estavam preservadas em `src/data/rulesStore.json`. Reutilizei essa fonte, sem substituir por regras gerais de internet nem declarar uma nova leitura do anexo ausente. A base passou de 2.15.3 para 2.16.0 com um campo opcional de critérios semânticos; não mudei as severidades.

Antes de alterar, o legado passou em typecheck, build e 871 testes, com um teste de capacidade pulado. Após a alteração do contrato/base: **872 testes passaram, um pulado; typecheck e build passaram**. Uma execução isolada do Vitest foi impedida por permissões em arquivos temporários do ambiente; a repetição com a permissão de execução apropriada passou, sem alteração de código para esconder falhas.

## O que mudou de verdade

Criei uma rota Python separada. A janela usa Tkinter; o BGE reranker quantizado em ONNX relaciona trechos às descrições das regras. O motor resolve as conclusões e monta uma resposta curta com a mensagem/orientação cadastrada. Não há geração longa por Qwen, llama-server, chave ou fallback online. A análise funciona offline depois da preparação.

Regras claras evitam a rede neural. Casos com linguagem diferente usam o modelo local. A comparação semântica é **relevância**, não prova matemática nem porcentagem de acerto. Uma parte não entendida não deve encerrar a OS com a primeira falha reconhecida. O motor mantém sem decisão quando falta base; perguntas e hipóteses não fingem classificar uma OS real.

Comparei também mDeBERTa NLI e multilingual-e5-small, mas não selecionei esses candidatos: confundiram etapas ou apresentaram baixa discriminação nos ensaios. Os pesos experimentais locais não entram na distribuição. No BGE, um par por inferência eliminou a dependência da saída em relação à composição dos lotes quantizados. Isso foi relevante: uma interpretação mudou de etapa ao variar o lote nos ensaios iniciais.

## Medições reproduzidas nesta máquina

| Verificação | Resultado |
| --- | --- |
| Testes Python de motor, sessão, falha do modelo, integridade e pacote | 28 passaram |
| Corpus anterior, sessão real e comparação de regras + conclusão | 50/53 |
| Cenários sintéticos adicionais com modelo real | 16/16 |
| Mediana / máximo de análise no corpus de 53 | 14,82 ms / 2.374,17 ms |
| Mediana / máximo nos 16 adicionais (repetição após empacotar) | 327,60 ms / 1.981,01 ms |
| Carregamento do modelo no avaliador do corpus | 1.337,82 ms |
| Carregamento/verificação do motor no avaliador adicional | 3.882,48 ms |
| Janela real: equipe, novo caso, serviço e paráfrase | passou |
| Avaliação adicional com conexões de socket bloqueadas e independência dos pares | passou |
| EXE portátil 0.1.1: lexical + inferência real | passou; análise semântica de 346,77 ms |
| Inicialização e diagnóstico interno do EXE | 3.507,89 ms, incluindo duas análises; não inclui todo o custo de criação do processo/imports anteriores ao temporizador |

São medições sintéticas nesta máquina, com condições de cache e carga próprias, não um SLA nem teste no Latitude. Os testes adicionais foram usados durante desenvolvimento, portanto **não são um conjunto cego de homologação**. Não atribuo o ganho só à troca para Python: a principal mudança é deixar de gerar dezenas de tokens com um modelo grande a cada interpretação.

### Os três casos que ainda não concluem como o gabarito

- Trena mencionada em uma oração e impossibilidade de conferir a dimensão explicada em outra: ainda pede detalhe, em vez de recomendar Reprovado.
- Duas etapas ausentes com “fase inicial” e “nem de quando aplicaram a massa”: identifica a primeira, mas não confirma a combinação completa; não emite Não Conforme parcial como resultado final.
- Resultado presente com “nenhuma mostrando o estado da vala quando chegaram”: a retomada do sujeito ainda não ficou suficientemente reconhecida.

Não alterei os resultados esperados do corpus para fazer esses casos passarem. Nesses três houve abstenção/devolutiva, não uma conclusão oficial diferente. Isso **não prova ausência de erros** fora da amostra. Relevância, negação, correferência, múltiplas irregularidades na mesma oração e correções complexas ainda exigem testes adversariais e validação operacional.

## O que ainda falta

1. Reduzir as três abstenções com interpretação de escopo/retomada mais robusta, sem enfraquecer os testes de presença e negação nem cadastrar uma frase para cada pergunta.
2. Separar um conjunto operacional novo, revisado pelo responsável, que não seja usado para ajustar o motor; medir conclusões **e regras aplicadas**.
3. Medir abertura fria, resposta quente e memória no Latitude real. Não tenho acesso remoto ao notebook nesta rodada.
4. Migrar feedback, importação auditada de regras e métricas administrativas para a nova janela. Não foram apagados do legado, mas não estão disponíveis na interface Python.
5. Revisar a política de ranking antes de oferecer todos os outros serviços. A interface atual expõe só os dois Asfaltos, cuja política cadastrada prioriza a mais grave entre regras aplicáveis.
6. Validar uma cópia do pacote em máquina limpa. A execução local do EXE não garante reputação SmartScreen, assinatura digital nem compatibilidade com políticas corporativas.

## Entrega

Versão Python **0.1.1**, separada da versão legada 2.23.0. Pasta em `python/dist/AEBOT-Python-0.1.1`, com modelo, runtime, guia, licenças e manifesto SHA-256. O EXE não possui certificado próprio. Não alterei nem recomendei desativar proteções do Windows. Não incluí chave de API, conversa ou perfil de usuário.

**Não considero o objetivo “100% de acerto em poucos segundos para qualquer pergunta” concluído.** O protótipo reduziu o tempo nos ensaios e preservou decisões rastreáveis, mas precisa dos passos acima antes de ser tratado como substituição definitiva.
