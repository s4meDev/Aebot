# Entrega de apoio à análise — Python 0.6.3

12/11/2026 · Base 2.20.0 preservada · Repavimentação Asfalto

## O que corrigi

Na preparação para o uso pelos analistas, ampliei os controles sobre equipe e frente. “Interna e terceirizada” e a enumeração “interna, terceirizada” não podem escolher o último vínculo. Quando há valores contraditórios no mesmo turno e escopo, mantenho a informação pendente. Uma correção explícita ou uma resposta posterior pode resolver a dúvida, sem apagar as falhas já relatadas.

Também corrigi a retirada de uma confirmação: “Corrigindo: não tenho certeza se é interna” suspende o vínculo anterior. “Acho que”, “pode ser” e outras formas de incerteza não confirmam contexto. A resposta curta à pergunta seguinte precisa funcionar sem ficar presa a uma falsa pendência sobre uma nova evidência. Se a incerteza trouxer outra ocorrência, essa ocorrência continua sujeita a esclarecimento próprio.

Na recuperação de contexto, remover palavras gramaticais não pode transformar “dá para trocar” no verbo “trocar” isolado. Dizer que preciso trocar não comprova que o sistema oferece a opção correta. A disponibilidade continua exigindo suporte no relato.

Não alterei conclusões, regras de negócio, serviço selecionado, limiares do BGE nem gabaritos anteriores. Os exemplos novos são sintéticos, não conversas reais dos analistas. O perfil continua com duas faixas e 39 regras/orientações; os demais serviços permanecem no histórico da fonte única.

## Arquivos e manutenção

- `text.py`: reconhece incerteza e protege expressões de contexto que perderiam seu sentido ao retirar palavras gramaticais.
- `facts.py`: mantém a origem em memória de cada contexto para distinguir conflito no mesmo turno de uma confirmação posterior. Contexto não confirmado continua como `null`, sem reutilizar o valor antigo.
- `extraction.py`: separa dúvida sobre contexto de uma nova ocorrência incerta, sem atalho por tamanho da mensagem.
- `tests/test_release_readiness.py` e `audits/release_cases.py`: controles novos, sem reescrever a suíte antiga.
- `USAR-ASFALTO.md`: guia curto para abrir, conversar, conferir e reunir feedbacks.

## Validação da entrega

Os 156 testes Python passaram. Escrevi 12 métodos novos de prontidão; os oito iniciais revelaram oito falhas/subcasos antes da correção. A suíte anterior e seus gabaritos foram preservados. Os 878 testes do legado passaram, com um ignorado. A execução Vitest usou a autorização do cache temporário fora do sandbox, sem alterar proteções do Windows.

| Conferência | Resultado |
| --- | --- |
| Auditoria completa com modelo real | 1.454/1.456 no critério completo; 1.455/1.456 decisões esperadas. |
| Cenários novos de contexto | 62/62, nas duas faixas; confere decisão, fundamentos e perguntas. |
| Conclusão oficial indevida / falha técnica | Nenhuma nessa amostra. Houve uma abstenção divergente do gabarito antigo. |
| Cobertura do perfil | 39/39 regras/orientações; nenhuma classificatória sem relato factual sintético. |
| Corpus independente preservado | 52/53 completos; 53/53 decisões. A divergência é de citação. |
| Cenários semânticos adicionais | 16/16; rede bloqueada no teste e independência dos pares conferida. |
| Janela com modelo real | Passou em três tamanhos, incluindo 580 × 500, com envio, fundamentos, feedback, retomadas e recuperação após falha. |
| Typecheck / build do legado | Ambos passaram na conferência final. |
| EXE novo | Três novas instâncias passaram no diagnóstico completo. |
| Fonte e pacote | Hashes da auditoria conferidos; catálogo empacotado idêntico à projeção validada da fonte única. |

O relatório principal é `python/artifacts/full-063-2026-11-12.json`. As duas divergências mantidas são: a consulta sobre duplicidade cita a regra como consulta, enquanto o gabarito antigo espera nenhuma; a frase “tem o começo e o pronto, só não tem o pessoal fazendo o serviço” pede para distinguir falta de registro de falta de execução, enquanto o gabarito espera Não Conforme. Não mudei esses casos para anunciar acerto total.

Uma grande parte da auditoria é de combinações padronizadas. O conjunto é sintético, não uma amostra representativa das OS reais da empresa; a razão de acertos dessa suíte não é uma garantia estatística de acerto no uso. Perguntas informais ainda podem exigir esclarecimento. O guia `COMO-USAR.md` inclui controles simples para conferir a instalação antes de começar.

### Tempos desta máquina

| Caminho da auditoria principal | Mensagens | Média | P95 | Máximo |
| --- | --- | --- | --- | --- |
| Com chamada real ao modelo | 101 | 1,33 s | 2,45 s | 3,10 s |
| Sem nova chamada ao modelo | 1.524 | 9,14 ms | 16,01 ms | 31,49 ms |

Os 62 cenários novos contêm 130 mensagens de contexto, resolvidas sem nova chamada neural; não apresento esse tempo como inferência. O corpus independente teve mediana de 5,59 ms e máximo de 2,91 s; os 16 cenários semânticos adicionais tiveram máximo de 2,51 s. Separar os caminhos evita anunciar milissegundos como se todas as perguntas complexas fossem assim.

Medi em Windows 11, Python 3.12.14, 7,87 GiB de RAM física e 12 processadores lógicos. Não é homologação do Latitude, tempo universal nem coleta de uso dos analistas. Picos históricos de versões anteriores continuam registrados.

### Executável e entrega

O relatório `python/artifacts/exe-063-2026-11-12.json` registra três execuções novas do EXE, sem outra suíte em paralelo. Cada execução conferiu modelo, base, Tk, fundamentos, esclarecimento/retirada de equipe e formulário/leitura de feedback sintético temporário. Todas passaram. O processo completo levou entre 3,61 e 4,00 s, incluindo abertura, verificações e encerramento; não confundo isso com latência de uma pergunta. A chamada semântica isolada do diagnóstico levou entre 0,69 e 0,88 s. Não limpei o cache de arquivos do Windows nem anunciei medição de boot frio.

O pacote `python/dist/AEBOT-Python-0.6.3.zip` leva executável, modelo, recursos, licenças, diagrama e guias. `00-COMECE-AQUI.txt` explica como abrir e `COMO-USAR.md` orienta a operação. Este relatório acompanha a entrega como `RESULTADOS-TESTES.md`. A pasta inteira é necessária; não há Setup, chave ou servidor para o analista configurar.

O empacotador confere os hashes e a lista exata de arquivos antes de criar o ZIP, e verifica o CRC depois. Só os guias e seu manifesto são atualizados após o diagnóstico; binários e modelo não são trocados. Relatórios sintéticos de desenvolvimento, credenciais, perfil e banco do usuário não entram na distribuição. A varredura dos trechos adicionados rastreados não encontrou padrões de credenciais; nenhum segredo foi adicionado nesta rodada.

## Critério de uso

Entrego um assistente de apoio à análise, não um classificador autônomo infalível. O analista confere os fundamentos na OS antes de concluir. Se falta contexto ou o relato admite interpretações diferentes, perguntar é o comportamento esperado, não motivo para forçar uma conclusão.

O BGE não é um modelo gerador como ChatGPT. Não troquei de arquitetura às pressas nem anunciei uma capacidade que ele não tem. A análise permanece offline. Conversas e tempos não são persistidos; apenas o formulário voluntário de feedback e as versões são salvos. O pacote não recebe perfil, banco de feedback ou credenciais.

O EXE não tem certificado próprio do AEBOT; não altero controles do Windows. A execução nesta máquina não homologa todas as instalações nem o Latitude. As entregas anteriores são preservadas.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
