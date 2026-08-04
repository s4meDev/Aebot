# AEBOT

Extensão Chrome Manifest V3 para assistente operacional de analistas de serviços de campo.

## Arquitetura

- React + TypeScript + Vite
- Manifest V3 com Side Panel
- Armazenamento local via `localStorage` com abstração de storage
- Base de conhecimento local em repositório tipado
- Provider de IA abstrato para futura troca de fornecedor

## Instalação

1. Execute `npm install`.
2. Execute `npm run build`.
3. Abra `chrome://extensions` e ative o modo desenvolvedor.
4. Clique em “Carregar sem compactação”.
5. Selecione a pasta `dist` gerada pelo build.

## Configuração de IA

Defina a variável de ambiente:

```bash
VITE_GEMINI_API_KEY=sua-chave
```

Também é possível informar a chave localmente no painel de configuração. Nenhuma chave deve ser versionada. Sem chave, a extensão usa a mesma avaliação determinística no modo simulado.

## Qualidade

- `npm test`: testes do motor de regras e do provider.
- `npm run typecheck`: validação TypeScript estrita.
- `npm run build`: validação completa e geração da extensão Manifest V3.

## Uso

- Selecione um serviço no painel lateral.
- Faça a pergunta ou descreva os fatos da Ordem de Serviço.
- Confira a decisão recomendada, as regras utilizadas e a orientação.
- Quando a base for insuficiente, valide com o responsável e atualize as regras.
