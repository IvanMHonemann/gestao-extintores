# Relatório de migração segura — Gestão de Extintores

**Data da validação:** 2026-09-27/28  
**Origem analisada:** `/home/ubuntu/upload/gestao-extintores-main(1).zip`  
**Cópia de trabalho:** `/home/ubuntu/work/gestao-extintores-main`

## Resumo executivo

Foi feita uma inspeção e validação local **sem conectar ao banco, sem criar banco, sem executar migrações, sem seed, sem backup de dados reais e sem publicar no GitHub**.

O código passou no typecheck, no build de produção, nos testes de autenticação e na validação do servidor/bundle estático. A suíte completa que depende de dados falhou porque esta sessão não possui `EXTERNAL_DATABASE_URL` configurada. A migração de produção não pode ser declarada concluída.

## Checklist obrigatório

- [x] Código extraído em cópia isolada, preservando o ZIP original.
- [ ] Repositório/remote GitHub confirmado — **não confirmado**; o ZIP não contém `.git` e não houve autenticação GitHub disponível.
- [ ] Branch e commit final — **não aplicável na cópia ZIP**.
- [ ] Banco existente confirmado sem banco novo — **não executado**; não há `EXTERNAL_DATABASE_URL` nesta sessão.
- [ ] Secrets configurados fora do código — **não configurados** nesta sessão.
- [ ] Senha antiga rotacionada — **não verificável**; deve ser rotacionada no TiDB Cloud antes da conexão.
- [ ] Backup completo criado — **não executado**; exige acesso ao banco e deve ser feito fora do repositório, com modo 600.
- [ ] Schema comparado em modo somente leitura — **não executado**; exige acesso ao banco.
- [ ] Migração de schema executada — **não executada deliberadamente**.
- [x] Typecheck — `pnpm run check` passou sem erros.
- [ ] Suíte completa de testes — **8 falhas / 9 testes aprovados / 17 total**; as falhas são dependentes de dados/banco ausente.
- [x] Testes de autenticação locais — **3 aprovados / 3 total**.
- [x] Build — `pnpm run build` concluído.
- [ ] Smoke test de login com conta real — não executado; requer ambiente protegido e credenciais fornecidas pelo responsável.
- [ ] Smoke test de cliente/extintor/OS — não executado; requer banco existente.
- [ ] Isolamento multi-tenant contra dados reais — não concluído; testes de dados falharam sem banco.
- [ ] Lixeira, restauração e exclusão permanente — não executado contra banco.
- [x] Bundle de produção sem marcadores de HMR — validado; nenhum `@vite/client`, `html-proxy`, `vite-hmr` ou websocket de desenvolvimento encontrado.
- [x] PWA/artefatos estáticos — `dist/public/index.html` e `dist/public/manifest.json` presentes.
- [ ] PDF/impressão/compartilhamento — não validado em navegador/dispositivo real.
- [ ] CI GitHub — não executado; remote/autenticação ausentes.
- [ ] URL/host público atual — não validado.
- [x] Rollback preservado — nenhum arquivo original ou banco foi alterado.

## Evidências locais

### Ferramentas

- Node.js: `v22.13.0`
- pnpm: `10.4.1`
- Instalação: `pnpm install --frozen-lockfile` concluída.

O `corepack enable` inicialmente falhou por erro de verificação de assinatura; a validação prosseguiu instalando globalmente a versão exata `pnpm@10.4.1`, declarada no projeto. Nenhuma verificação foi desativada.

### Build e servidor

- `pnpm run check`: **passou**.
- `pnpm run build`: **passou**.
- Servidor: `NODE_ENV=production PORT=3000 MANUS_INTEGRATIONS=false pnpm start` iniciou corretamente.
- `GET /`: HTTP **200**.
- `GET /manifest.json`: HTTP **200**.
- Warnings do build: placeholders de analytics não definidos e chunk principal acima de 500 kB. Não foram feitas alterações estruturais arriscadas.

### Testes

- `server/auth.logout.test.ts`: passou.
- `server/memberAuth.test.ts`: 2 passaram.
- Testes de negócio, isolamento e banco externo: falharam por ausência de dados/conexão configurada nesta sessão; não foram corrigidos com seed, escrita ou alteração de schema.

## Bloqueios para a próxima fase

O responsável pela nova hospedagem precisa configurar **somente no secret manager**:

- `EXTERNAL_DATABASE_URL` com a senha nova, TLS obrigatório, apontando para o banco existente;
- `JWT_SECRET`, preservando o atual somente se as sessões existentes precisarem continuar válidas;
- `MANUS_INTEGRATIONS=false` fora da Manus;
- `PORT=3000`.

A senha anteriormente compartilhada deve ser considerada exposta e rotacionada antes do uso. Depois disso, ainda é necessário:

1. criar backup completo fora do repositório;
2. executar o teste read-only de conexão;
3. comparar tabelas/colunas do schema local com o banco real;
4. parar e reportar qualquer divergência antes de qualquer migração;
5. executar smoke tests protegidos com conta existente;
6. autenticar no GitHub, confirmar remote/branch e somente então avaliar CI/push.

Nenhuma dessas etapas deve ser simulada com credenciais inventadas ou banco novo.
