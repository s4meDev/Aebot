# Revisão do AEBOT — 13/10/2026

## Situação

O código está em **2.23.0**, com a base **2.15.3**. Corrigi falhas de interpretação e reorganizei o núcleo. **A meta de respostas complexas em poucos segundos ainda não foi atendida.** Não gerei nem publiquei um novo EXE como se esse problema estivesse resolvido. O download 2.22.1 permanece separado e não contém estas alterações.

O usuário informou demora acima de 30 segundos nos dois computadores. Como as conversas anteriores não foram preservadas, usei casos sintéticos para reproduzir combinações de fatos, negações e respostas curtas, sem mudar a política de privacidade.

## O que corrigi

1. Uma regra conhecida não encerra a avaliação quando há outro fato ainda não compreendido. Antes, a primeira falha podia produzir uma conclusão parcial.
2. Fatos já comprovados pelo motor são preservados antes e depois da conferência semântica. Uma hipótese do modelo não pode apagá-los; condições e exceções continuam validadas sobre o relato completo.
3. Orações com “e não” e “nem” mantêm a negação e as citações literais. Acrescentei dois casos de regressão; Asfalto passou de 51 para 53 casos.
4. Verbos como “existe” e “consta” não comprovam ausência de evidência.
5. Interpretação e conferência usam o mesmo prefixo de sistema. O modo da chamada fica no pedido; todas as regras classificatórias e a validação de cada citação/estado foram preservadas.
6. Contexto obrigatório já confirmado pelas regras não precisa de outra chamada ao modelo. “Equipe interna” e “terceirizada” continuam usando o estado tipado da pergunta pendente.
   O atalho agora aceita somente os termos de contexto cadastrados nas regras aplicáveis, não qualquer mensagem de até três palavras. “Interna, acabamento ruim” precisa analisar também o novo problema.
7. O cache usa hash do relato original, intenção e histórico recente, com campos separados por serialização JSON. Uma pergunta não reaproveita a interpretação de um relato só porque a normalização removeu o ponto de interrogação. Texto e respostas continuam fora dos diagnósticos.

## Organização do código

- `AnalysisProvider`: coordenação da análise, sem nome de provedor específico.
- `GeminiModelClient`: transporte HTTP e configuração do Chrome legado.
- `GeminiProvider`: fachada de compatibilidade, sem copiar lógica.
- `ModelContents`: histórico recente e mensagem atual sem duplicação.
- `AnalysisCoverage`: completude do relato e contingência segura.
- `FactSources`: segmentação genérica de fatos, sem IDs ou etapas de serviço fixados no código.

Mantive React/TypeScript/Electron. O trabalho pesado do modelo já roda em C++ no llama.cpp; uma migração para Python não elimina esse custo e criaria outro runtime para manter e empacotar. A decisão pode ser revista se uma implementação demonstrar vantagem real. Não acrescentei dependências de inferência ao aplicativo.

## Medições reais

Referência desta rodada: Ryzen 5 5600G, aproximadamente 8 GB de RAM, CPU, runtime `b11160-mix-a6922cc`. A RAM livre registrada é uma fotografia, não o pico de consumo. As medições não reproduzem o hardware do Latitude. Rodadas exploratórias com código/prompt diferentes não são comparações controladas nem confirmação de uma melhoria percentual.

| Rodada | Resultado técnico | Tempo com IA | Decisão |
| --- | --- | --- | --- |
| Qwen3-4B anterior, 9 casos complexos | 9/9 | mediana 73,1 s; máximo 88,3 s | referência antes da revisão |
| Qwen3-4B v34, 5 casos críticos | 5/5, regras e conclusões | mediana 70,1 s; máximo 78,4 s | correções passaram no recorte; latência inadequada |
| Qwen3.5-2B, protocolo por IDs, 53 casos | 39/53; 14 divergências, 10 reprovações perdidas | mediana com IA 2,0 s; máximo 71,3 s | rejeitado |
| Qwen3.5-2B, contrato experimental por grupos, 53 casos | 41/53; 12 divergências | mediana com IA 3,0 s; máximo 47,7 s | rejeitado |
| Granite 4.0 H Micro, protocolo por IDs, 53 casos | 39/53; 14 divergências | mediana com IA 6,2 s; máximo 89,1 s | rejeitado |
| Granite, contrato experimental por grupos, 53 casos | 24/53; 29 divergências | mediana com IA 10,4 s; máximo 109,7 s | rejeitado |
| Qwen3.5-4B, 11 casos complexos | 10/11; perdeu uma ausência inicial | mediana 25,1 s; máximo 137,6 s | não adotado |
| Qwen3-4B v34, primeira rodada completa | 53/53; nenhuma divergência | mediana com IA 11,6 s; máximo 125,8 s | 46 chamadas; ainda lento nos casos complexos |
| Qwen3-4B v34, atalhos lexicais revisados | 53/53; nenhuma divergência | mediana com IA 16,7 s; máximo 70,3 s | 36 chamadas; 10 chamadas desnecessárias eliminadas |

A última rodada teve 26 casos com IA e 27 sem IA. Os determinísticos tiveram mediana de 4 ms; não uso esse tempo para anunciar velocidade do modelo. Ao retirar dez casos rápidos do grupo “com IA”, a mediana desse grupo passou a representar casos mais complexos. Não conclua que o modelo ficou mais rápido pela comparação dos máximos: carga da máquina e estado de memória variam entre rodadas. A inicialização do runtime na última rodada levou 12,1 s, separada das análises; a primeira análise com modelo levou 68,8 s.

Após essa rodada, ajustei a serialização do histórico na chave do cache e restringi o atalho de esclarecimento ao contexto realmente cadastrado. As proteções têm testes de contrato; a instrução do modelo, o catálogo e o matching não mudaram. Os arquivos registram o hash do avaliador realmente executado, não uma alegação de homologação de qualquer build futuro.

No código final, repeti os dois casos novos com IA real: **2/2**, com regras e conclusões corretas, em 58,5 s e 57,0 s. Isso confirma a correção nesse recorte, mas também confirma que a demora continua incompatível com a meta. Não trate essa repetição como uma nova execução completa dos 53 casos.

Repeti também as continuações “interna” e “terceirizada” no cliente real: **2/2**, em 30 ms e 11 ms, com conclusões corretas e nenhuma chamada ao modelo. O runtime foi iniciado, mas essas respostas são determinísticas; não são uma medição de inteligência do Qwen.

O contrato experimental por grupos foi retirado do código final: não deixou uma opção não validada disponível para o aplicativo. Os relatórios permanecem preservados.

Um ensaio isolado com [MiniLM multilingual NLI](https://huggingface.co/MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli), convertido para ONNX, carregou em cerca de 0,7 s e avaliou lotes em 37–80 ms. Apesar da velocidade, confundiu relações de significado em português, inclusive ausência de registro e ausência de execução. Não há autorização para decidir por mera semelhança. Não foi integrado, selecionado ou empacotado. Arquivos e dependências desse ensaio ficam em `.semantic-lab/`, ignorados pelo Git.

### Arquivos de referência

Os relatórios completos locais ficam em `desktop-release/evaluations/`, fora do Git:

- `2026-10-13T13-34-43-900Z.json`: referência anterior de 9 casos.
- `2026-10-13T13-54-27-130Z.json`: encurtamento excessivo da conferência; duas divergências, ajuste recusado.
- `2026-10-13T14-02-24-308Z.json`: Qwen3.5-2B por IDs.
- `2026-10-13T14-06-30-709Z.json`: Qwen3-4B, 5 casos críticos corrigidos.
- `2026-10-13T14-15-15-825Z.json`: Qwen3.5-2B por grupos.
- `2026-10-13T14-23-20-120Z.json`: Granite por IDs.
- `2026-10-13T14-33-06-267Z.json`: Granite por grupos.
- `2026-10-13T15-00-46-289Z.json`: Qwen3.5-4B, 11 casos.
- `2026-10-13T15-08-33-427Z.json`: primeira rodada completa Qwen3-4B v34, 53/53.
- `2026-10-13T15-25-12-370Z.json`: repetição completa com atalhos lexicais, 53/53.
- `2026-10-13T15-48-50-594Z.json`: repetição dos dois casos novos no código final, 2/2.
- `2026-10-13T15-52-07-669Z.json`: confirmações de equipe interna/terceirizada no código final, 2/2 sem inferência.

`local-evaluation.json` identifica a rodada mais recente, inclusive quando ainda estiver em andamento. Verifique `completed` e `status`; um relatório parcial não é aprovação.

## Validação de engenharia

- A suíte final teve **871 testes aprovados e 1 separado**; esse teste de capacidade foi executado isoladamente e também passou, com 3.000 avaliações determinísticas. Não mede inferência nem disponibilidade da API publicada.
- Typecheck do frontend, ferramentas, servidor e Worker aprovado.
- Build da extensão, servidor Node e Worker aprovado; Worker executado somente em dry-run, sem deploy.
- Build desktop e smoke Electron aprovados: renderer isolado, ponte IPC, catálogo e análise determinística. Esse smoke não carrega o modelo nem homologa um EXE empacotado.
- Auditoria da base aprovada: 36 serviços, 99 regras/orientações, sem avisos estruturais. Oito serviços ainda estão com regras pendentes e seis nomes aguardam confirmação.
- A validação do Manifest V3 detectou versão antiga no manifesto-fonte; alinhei somente a versão com `package.json`, preservando permissões e chave pública. A extensão comum e o perfil empresarial foram revalidados; o bundle Node também passou na verificação de segredos incorporados.
- Diff revisado; nenhum segredo identificado nos arquivos alterados. Nenhum arquivo funcional removido. README, arquitetura, guias de execução e decisões permanentes atualizados.

O gabarito sintético não substitui revisão operacional. Não redesenhei a interface nem adicionei nova linguagem/runtime nesta etapa; priorizei a lógica, a medição e a manutenção do núcleo.

## Privacidade e distribuição

O desktop continua offline, com credencial temporária no loopback e sem contingência de nuvem. Nenhuma conversa foi persistida. Os ensaios transmitiram somente downloads públicos de modelos; relatos sintéticos foram processados localmente. Modelos, dependências experimentais e credenciais ficam fora do Git. Não alterei proteções do Windows nem o perfil de assinatura empresarial.

## Próximo passo

Continuar a busca por uma interpretação local rápida **com validação do significado**, preservando o motor e o catálogo completo. Comparar soluções sobre o corpus ampliado e sobre novos exemplos fornecidos voluntariamente. Adoção exige conferir fatos/regras, primeira resposta fria, respostas quentes, falhas e latência no Latitude. Só depois preparar e validar o EXE atualizado. Não considerar a rapidez de `mappings: []` como um acerto de compreensão.
