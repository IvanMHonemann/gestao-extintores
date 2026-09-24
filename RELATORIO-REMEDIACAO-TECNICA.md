# Relatório de remediação técnica — Gestão de Extintores

**Data:** 24 de setembro de 2026  
**Escopo:** correções de segurança multiempresa, integridade de dados, autenticação própria e operação offline-first após a auditoria técnica.

## Resultado executivo

A remediação eliminou o caminho em que uma identidade OAuth sem empresa podia alcançar consultas comerciais sem filtro. Todas as procedures de negócio agora exigem uma conta comercial válida, e o backend repassa o `accountId` ao acesso de dados como requisito obrigatório. A conta administrativa também possui um tenant próprio; portanto, as operações administrativas sobre dados comerciais não dependem de um escopo global implícito.

O armazenamento offline foi particionado por `tenantKey`. Clientes, extintores, ordens, alertas, configurações, metadados e fila de mutações são lidos e gravados somente no namespace da conta autenticada. Backups carregam a empresa de origem, a versão do formato e passam por validação antes de qualquer substituição local.

A migração de banco foi aplicada e verificada no ambiente. Os registros legados foram classificados e associados deterministicamente ao tenant administrativo; não foram encontrados extintores ou ordens órfãos. Configurações de alertas passaram a ser por empresa e os números de OS deixaram de depender de uma constraint global incompatível com o histórico existente.

## Correções implementadas

| Área | Remediação | Resultado verificado |
|---|---|---|
| Autorização | Criada `commercialProcedure` com usuário autenticado e `accountId` positivo obrigatório; criada proteção administrativa comercial para configurações | OAuth sem tenant recebe `FORBIDDEN` e não acessa dashboard, clientes, alertas ou ordens |
| Acesso ao banco | Helpers de clientes, extintores, OS, alertas, estatísticas e configurações exigem tenant e filtram diretamente por `accountId` | Nenhum helper comercial mantém caminho global por `accountId` indefinido |
| Integridade | `accountId` obrigatório em clientes, extintores, ordens e configurações; FKs e índices adicionados; itens de OS ligados por FK com deleção em cascata | Banco apresenta colunas `NOT NULL`, FKs e índices de relacionamento |
| Exclusão | Exclusão de cliente usa transação e remove OS, itens e extintores do mesmo tenant | Não foram encontrados órfãos no banco durante a verificação |
| Configuração | `system_settings` usa unicidade composta `(accountId, settingKey)` | Empresas podem configurar antecedência de alerta independentemente |
| Sessões | Rate limiting em login, recuperação e troca de senha; limpeza oportunística de sessões expiradas; bloqueio de sessões ao desativar conta | Cinco falhas dentro da janela de 15 minutos acionam bloqueio temporário em memória |
| Cookies | Sessão comercial usa `SameSite=Lax`; somente o cookie do fluxo OAuth preserva `SameSite=None` | Logout continua limpando ambos os fluxos corretamente |
| Offline | Todos os registros locais têm `tenantKey`; migração local marca dados antigos como não atribuídos e não os exibe a contas válidas | Snapshot da conta administrativa contém 3 clientes, 5 extintores, 1 OS e nenhum registro sem tenant |
| Fila | Criações e exclusões offline são persistidas, remapeiam IDs negativos após reconexão e registram falhas para nova tentativa | Exclusão de registro criado offline não deixa o registro remoto criado sem ser removido |
| Backup | Formato versão 2, tenant de origem, validação de todas as linhas e confirmação explícita para substituir dados | Backup exportado foi criado com `tenantKey` correto e restaurado somente no mesmo namespace |
| PWA | Service worker, manifesto, instalação, atualização automática e limpeza de cache preservados | Registro de service worker e manifesto foram detectados no navegador |

## Validação automatizada

A validação executada no projeto foi:

| Verificação | Resultado |
|---|---:|
| `pnpm check` | Aprovado |
| `pnpm test` | Aprovado — 4 arquivos e 10 testes |
| Teste de isolamento A/B | Aprovado — listagem, detalhe, OS, extintores, atualização e exclusão cruzadas bloqueadas |
| Teste de OAuth sem tenant | Aprovado — procedures comerciais retornam `FORBIDDEN` |
| `pnpm build` | Aprovado |
| Sintaxe do service worker | Aprovado com `node --check client/public/sw.js` |
| Verificação de FKs, índices e `NOT NULL` | Aprovada por consulta ao schema real |
| Teste de snapshot offline no navegador | Aprovado — dashboard reexibiu 3 clientes, 5 extintores, 3 alertas próximos, 1 vencido e 1 OS |
| Teste de recarga com sessão em cache | Aprovado — sessão própria permaneceu disponível e os dados locais foram reapresentados |
| Exportação de backup | Aprovada — JSON versão 2 com `tenantKey` e metadata de exportação |

O build ainda informa um aviso de bundle JavaScript acima de 500 kB. Isso não bloqueia a execução, mas recomenda code splitting antes de crescer a base de clientes.

## Estado do banco verificado

A inspeção do banco confirmou que as colunas de tenant relevantes estão `NOT NULL`. Também foram confirmadas as relações entre clientes e contas, extintores e clientes, ordens e clientes, itens e ordens, além da relação de configurações com contas. A distribuição de dados permanece separada por tenant e a consulta de órfãos retornou zero para extintores e ordens.

Os dados legados foram preservados. Não houve renumeração de OS. A migração foi ajustada para manter números históricos repetidos entre empresas, utilizando índice por `(accountId, orderNumber)` em vez de uma unicidade global que conflitaria com registros existentes.

## Riscos residuais e próximos passos

A interface atual concentra o fluxo principal em `Home.tsx` e oferece criação, leitura e exclusão no domínio principal, mas não expõe uma tela completa de edição de clientes, extintores ou OS. Consequentemente, não há uma operação de atualização offline de interface para sincronizar neste momento; caso a edição seja adicionada, ela deve usar a mesma fila particionada e uma política explícita de conflito.

O backup continua sendo um arquivo JSON legível por quem tiver acesso ao arquivo. A validação de tenant impede restauração cruzada, mas não fornece criptografia por senha. Para uso comercial em aparelhos compartilhados, recomenda-se adicionar AES-GCM derivado de senha antes de distribuir o arquivo fora do dispositivo.

A geração do próximo número de OS ainda usa `MAX + 1`. O índice por tenant evita confusão de escopo, mas criações concorrentes muito próximas podem disputar o mesmo número. Antes de escalar, recomenda-se uma sequência transacional ou uma tabela de contadores por empresa.

Também permanecem como melhorias de escala a paginação de listas, agregações SQL para o dashboard, logs estruturados de ações administrativas e testes reais em Android instalado, incluindo atualização do service worker durante uma sessão offline.

## Conclusão

Os bloqueadores de isolamento multiempresa, tenant obrigatório no backend, configuração global, integridade referencial básica, rate limiting inicial e mistura de dados no IndexedDB foram tratados. A prévia atual está compilando, testada e funcional no cenário de sessão própria online e offline com persistência local. Os riscos residuais estão documentados acima e não devem ser confundidos com falhas de autorização entre empresas, que foram cobertas pelos testes A/B e pelas verificações no banco.
