# Atualizações menores — Python 0.7.0

## O que implementei

Separei o ponto de abertura do aplicativo da versão que está ativa. `Abrir-AEBOT.exe` é um lançador pequeno, sem modelo de IA. A atualização é um ZIP estruturado `.aebot-update` com os arquivos alterados e um manifesto completo assinado com Ed25519. A chave pública fica no código; a privada fica na pasta ignorada `.aebot-private`, fora da distribuição.

O app abre o atualizador pelo botão **Atualizar**, depois de pedir confirmação para fechar o chat. O analista escolhe o arquivo que baixou. Não implementei consulta de servidor, atualização silenciosa ou envio de dados pela internet.

O manifesto declara versão de origem e destino, hashes, tamanhos, responsável, data e descrição. Arquivos iguais, inclusive o modelo, são copiados localmente da versão instalada. Arquivos novos vêm do pacote. Não aceito pacote sem assinatura reconhecida, arquivo extra, nome inseguro, links, modelo local diferente, origem incompatível ou downgrade por importação.

A nova pasta passa por verificação de todos os hashes e pelo diagnóstico real do EXE antes de ativar. Só então troco atomicamente um ponteiro pequeno. A instalação original e a versão anterior permanecem. Uma falha na preparação não ativa a pasta parcial. A trava de atualização é liberada pelo sistema se o processo terminar; não há comandos para derrubar processos ou desbloquear o Windows.

O rollback é uma ação explícita, diferente de aceitar uma atualização antiga por engano. Há retorno à instalação original ou à versão anterior preservada. Não há migração nem exclusão de feedbacks. Nada dessa funcionalidade muda as regras ou o modelo de análise da 0.6.3.

## Organização do código

- `aebot/updates.py`: contrato, validação, assinatura, reaproveitamento, preparação, ativação e rollback.
- `aebot/update_trust.py`: somente chave pública de confiança.
- `aebot/update_ui.py`: seleção do pacote e execução em segundo plano, sem bloquear a janela.
- `updater_main.py`: entrada do lançador independente.
- `create_update.py`: geração do pacote diferencial pelo mantenedor.
- `init_update_key.py`: criação única da chave local, sem sobrescrever uma existente.
- `package_app.py`: gera aplicativo e lançador, inclui os guias e não inclui a chave privada.
- `tests/test_updates.py`: controles de assinatura, corrupção, arquivos, falhas, rollback e preservação.

## Validação

| Conferência | Resultado |
| --- | --- |
| Testes Python | 173 passaram; 17 são de atualização, com chaves efêmeras e arquivos sintéticos. |
| Testes do legado | 878 passaram, um ignorado; typecheck e build passaram. |
| Janela principal | Passou com modelo real em três tamanhos, incluindo o botão Atualizar. |
| Janela de atualização | Passou em 560 × 480, 660 × 510 e 1024 × 700; seis controles visíveis, sem carregar ONNX. |
| EXE completo 0.7.0 | Três diagnósticos reais passaram; modelo, base, interface e feedback temporário conferidos. |
| Transição candidata 0.6.3 → 0.7.0 | Aplicação, diagnóstico real do novo EXE, interface congelada do lançador, rollback e reaplicação passaram. |
| Privacidade | Nenhum perfil real foi usado na migração. Banco de feedback fica fora das pastas atualizadas. A chave privada está ignorada no Git e não entra na distribuição. |

Os testes rejeitam assinatura desconhecida, conteúdo adulterado, arquivo extra, caminhos que escapam da pasta, nomes reservados do Windows, links no ZIP, metadados inválidos, origem errada, modelo local corrompido e reaplicação/downgrade indevidos. Também conferem falha no diagnóstico antes de ativar, falha atômica de ativação seguida de nova tentativa e rollback mesmo se o EXE ativo foi corrompido. Não removem estágios nem versões automaticamente.

O relatório da migração candidata fica em `python/artifacts/update-070-candidate-2026-11-12/report.json`. Usei uma cópia da entrega anterior, não sua instalação. A primeira aplicação levou 24,28 s nesta máquina, incluindo cópia local, hashes e diagnóstico do aplicativo; isso **não é tempo de resposta da IA**. O pacote candidato tinha 24.953.450 bytes (23,8 MiB), 27 arquivos alterados e cerca de 665 MiB reaproveitados localmente. A entrega final muda os guias de resultados, não os binários ou o modelo testados. O ZIP de transição acrescenta o lançador independente, portanto é maior que o `.aebot-update` sozinho.

O relatório `python/artifacts/exe-070-2026-11-12.json` registra os três diagnósticos do EXE. O processo completo ficou entre 3,72 e 4,35 s; cache do Windows não foi limpo. O lançador congelado foi conferido com o pacote assinado real e não carregou ONNX. Hashes do catálogo empacotado e da fonte da auditoria foram conferidos.

### Análise preservada

Reexecutei a auditoria com modelo real: **1.454/1.456 cenários completos**, 1.455 decisões esperadas e cobertura das 39 regras/orientações. As duas divergências antigas permanecem: citação da regra em consulta de duplicidade e esclarecimento em vez de conclusão na frase ambígua “tem o começo e o pronto, só não tem o pessoal fazendo o serviço”. Não alterei gabaritos para anunciá-las como acertos. Nenhuma conclusão oficial indevida ou falha técnica apareceu nessa amostra.

O relatório é `python/artifacts/full-070-2026-11-12.json`. As 101 mensagens com chamada ao modelo tiveram média de 1,24 s e máximo de 2,83 s. As 1.524 sem nova chamada tiveram média de 8,84 ms. O corpus independente manteve 52/53 completos, 53 decisões esperadas, com a divergência de citação; os 16 cenários semânticos adicionais passaram. Isso é validação sintética em Windows 11, aproximadamente 8 GB de RAM e 12 processadores lógicos, não garantia de 100% nem de tempo em qualquer notebook. A atualização não foi anunciada como melhoria da inteligência ou da velocidade de inferência.

## Manutenção

Depois de gerar e testar a pasta completa nova, gero o pacote a partir da pasta completa anterior:

```powershell
.\.venv\Scripts\python.exe python/create_update.py --from-dir python/dist/AEBOT-Python-0.6.3 --to-dir python/dist/AEBOT-Python-0.7.0 --output python/dist/AEBOT-0.6.3-para-0.7.0.aebot-update --notes "Descrição curta da revisão"
```

O comando recusa sobrescrever um pacote. A pasta anterior precisa ser exatamente a que foi distribuída. Preciso gerar um pacote para cada versão de origem que pretendo suportar; não se trata de um patch universal para qualquer versão. O conteúdo final é completo em disco, mas o download contém só diferenças.

Para a transição de uma versão sem botão Atualizar, gero também um ZIP com lançador e instruções:

```powershell
.\.venv\Scripts\python.exe python/bundle_update.py --package python/dist/AEBOT-0.6.3-para-0.7.0.aebot-update --launcher python/dist/AEBOT-Python-0.7.0/Abrir-AEBOT.exe --output-directory python/dist/Atualizacao-AEBOT-0.6.3-para-0.7.0
```

Antes de distribuir, confiro a transição em uma cópia separada com `test_update_exe.py`, a assinatura do pacote e o CRC dos ZIPs. Não publico um pacote com resultado antigo parecendo validação nova.

Faço backup seguro da chave privada de atualização. **Não envio `.aebot-private`, não a adiciono ao Git e não a copio para o ZIP.** Ela não está criptografada nesta implementação e precisa de proteção e backup no ambiente do mantenedor. Perdê-la exige planejar uma nova confiança/distribuição; não há rotação automática de chave nesta entrega. Não executo `init_update_key.py` de novo para substituir a identidade publicada.

O mecanismo continua sendo de protótipo sem certificado próprio de EXE. A assinatura Ed25519 do pacote não equivale ao Authenticode do Windows. O usuário precisa receber o lançador inicial por um canal confiável e conferir sua origem. Não altero proteções, não prometo disponibilidade automática de um servidor e não anuncio que o pacote já foi publicado online.

Usei a API de [assinatura e verificação Ed25519 do cryptography](https://cryptography.io/en/latest/hazmat/primitives/asymmetric/ed25519/). O ZIP é lido por entradas declaradas e limitadas, sem extração indiscriminada; a [documentação de zipfile](https://docs.python.org/3.12/library/zipfile.html) alerta para a validação de arquivos recebidos. Essas referências descrevem as bibliotecas, não homologam o AEBOT.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
