# Guia do desktop e do piloto

## Para o analista

1. Instale o pacote AEBOT entregue pela TI e abra o atalho.
2. Aguarde `Local · Qwen`. O primeiro carregamento pode levar mais tempo.
3. Selecione Reparo de Cavalete para o piloto e descreva o caso.
4. Se o assistente pedir informação, responda no mesmo chat. Para outra OS, use Novo caso.
5. Use Feedback para registrar um problema voluntariamente. Em configurações, exporte o relatório e encaminhe à referência operacional.

Não é necessário informar chave, token, URL, modelo ou porta. O chat permanece só na memória da janela. Fechar o aplicativo encerra o runtime local. Feedbacks e contagens permanecem no perfil do Windows.

Se aparecer `Local · regras`, abra as configurações: o aplicativo informará carregamento ou indisponibilidade do modelo. Ainda pode responder a regras determinísticas, mas linguagem ambígua pode exigir validação humana. O aplicativo não muda silenciosamente para IA externa.

## Para quem prepara o instalador

Use Windows x64, Node.js 22.12+ e espaço livre para o modelo, runtime e instalador (reserve pelo menos 10 GB para preparação).

```powershell
npm install
npm run desktop:assets
npm run desktop:build
npm run desktop:evaluate -- --limit=4
npm run desktop:package
```

Os downloads são de fontes oficiais, com revisões e hashes em `desktop-resources/assets-lock.json`. O instalador gerado inclui modelo e runtime; o usuário final não precisa de internet nem Node. Binários e pesos são ignorados no Git.

O instalador não é assinado com certificado corporativo nesta entrega. A TI deve aprovar o executável e o runtime conforme suas políticas antes de distribuí-los. Não desative controles de segurança para contornar bloqueios.

## Atualizar regras

Edite e teste `src/data/rulesStore.json`, aumente a versão da base e crie um pacote com `npm run desktop:rules -- --owner="Nome do responsável" --changes="Descrição da alteração aprovada"`. O arquivo sai em `desktop-release/rules-release.json`. Revise o conteúdo e distribua pelo canal aprovado.

Em cada desktop, use Configurações → Importar regras aprovadas. A aplicação valida a estrutura, os serviços e a versão; apresenta o responsável e a alteração antes da aplicação. A base anterior é preservada. Um pacote de mesma versão ou anterior é recusado; para corrigir regras, publique nova versão.

## Avaliar o modelo real

`npm run desktop:evaluate` compara o Qwen com 100 casos propostos de Cavalete (66 regressões existentes e 34 cenários em `src/data/desktopPilotCases.json`). Use `-- --limit=4` para uma amostra curta ou `-- --offset=66 --limit=6` para cenários novos. O relatório `desktop-release/local-evaluation.json` inclui decisão esperada/obtida, tempo, contingências e regras, sem registrar as conversas reais dos usuários. O último relatório substitui o anterior; preserve uma cópia antes de outra rodada se precisar comparar.

Prepare com a referência operacional pelo menos 100 perguntas do piloto, incluindo linguagem informal, informações faltantes, mudanças de caso, retificações, hipóteses, negações, ausência de duas etapas, local incorreto e parametrização. Casos técnicos não são automaticamente gabarito homologado. A ferramenta não anuncia aprovação de negócio.

Avalie inicialmente 5–10 analistas no hardware real, com os sistemas de trabalho abertos. Consolide relatórios exportados, compare erros críticos e confirme latência/memória antes de ampliar a 60 máquinas. Cada instalação processa sua própria carga; não há uma cota gratuita central.

## Arquivos locais e suporte

O perfil de aplicação (`%APPDATA%/AEBOT` no Windows padrão) armazena `metrics.json`, `feedback.json` e, após importação, `rules-release.json` e sua cópia `.previous`. Nunca copie um perfil inteiro para suporte: use Exportar métricas e feedbacks, que contém somente o necessário e não inclui o chat.

Pendências com a gestão: responsável pelas regras, gabarito homologado, configuração real dos notebooks, canal de distribuição e assinatura/liberação pela TI. A sincronização central de feedbacks do produto anterior não é usada neste modo offline.
