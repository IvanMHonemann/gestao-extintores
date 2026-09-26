# Prompt mestre para migração segura do Gestão de Extintores

> **Como usar:** copie todo o texto abaixo e envie para a outra conta ou IA responsável pela migração. Ela deve executar as fases na ordem, parar diante de qualquer divergência crítica e nunca inventar credenciais, banco, domínio ou permissões.

---

## PROMPT PARA A OUTRA CONTA/IA

Você é responsável por migrar e colocar em funcionamento o projeto **Gestão de Extintores**, um sistema full-stack multi-tenant para clientes, extintores, alertas e ordens de serviço.

### Objetivo

Migrar o código para esta conta/hospedagem mantendo:

- o mesmo banco MySQL/TiDB existente;
- todos os clientes, extintores, OS, usuários, empresas, sessões e configurações;
- o login próprio da aplicação, sem depender de Manus OAuth fora da Manus;
- o isolamento rigoroso entre empresas;
- o administrador geral e suas operações globais;
- o funcionamento offline-first/PWA;
- a geração e impressão de documentos de OS;
- a conexão segura com GitHub;
- nenhum secret, backup ou dado real no repositório.

**Não crie um banco novo, não faça seed em produção e não substitua secrets existentes sem explicar o impacto.**

---

## 1. Regras inegociáveis de segurança

1. **O GitHub guarda o código; o banco guarda os dados.** Nunca copie dados reais do banco para o GitHub.
2. Nunca coloque em arquivos versionados:
   - senha do banco;
   - URL completa do banco com senha;
   - `.env`;
   - tokens GitHub, Manus, SMTP, S3 ou JWT;
   - sessões, cookies ou chaves privadas;
   - backups completos ou dumps com dados reais.
3. O banco atual deve ser acessado por `EXTERNAL_DATABASE_URL`. `DATABASE_URL` pode existir como fallback, mas não substitua a URL externa sem verificar o runtime.
4. A senha do banco que foi compartilhada em conversas anteriores deve ser considerada exposta. **Rotacione-a no provedor MySQL/TiDB antes da migração** e use somente a nova senha no secret manager.
5. Fora da Manus, defina `MANUS_INTEGRATIONS=false`. O login comercial é próprio e usa as tabelas de contas/sessões da aplicação.
6. Não executar `DROP`, `TRUNCATE`, `DELETE` amplo, `pnpm db:push`, `drizzle-kit migrate` ou restauração com `--replace` sem:
   - backup completo recente;
   - comparação do schema local com o schema real;
   - explicação do impacto;
   - autorização explícita do responsável.
7. Se houver divergência entre o schema local e o banco, **pare e relate a divergência**. Não corrija com tentativa e erro.
8. Não usar `git push --force` para resolver divergência de histórico. Faça `fetch`, compare e integre com segurança.
9. Não usar `localhost:5173`, HMR ou Vite Dev Server como solução de produção/preview móvel. Validar o bundle estático produzido pelo build.
10. Não criar dados demonstrativos permanentes. Testes contra o banco de produção devem ser somente leitura ou usar registros temporários únicos, com limpeza comprovada.

---

## 2. Variáveis que precisam ser fornecidas pelo responsável

Solicite/configure os valores **somente no secret manager** da nova plataforma:

```text
EXTERNAL_DATABASE_URL=<URL completa do banco atual, com senha nova e TLS>
DATABASE_URL=<opcional; fallback compatível>
JWT_SECRET=<segredo longo; preservar o atual somente se as sessões existentes precisarem continuar válidas>
MANUS_INTEGRATIONS=false
PORT=3000
```

Opcional, apenas se o recurso for realmente utilizado:

```text
VITE_GOOGLE_MAPS_API_KEY=<somente se o mapa externo for habilitado>
```

Não escreva os valores acima em `README.md`, `.env.example`, logs, prompts públicos ou commits.

O perfil não secreto do banco está documentado em `DATABASE_MIGRATION_GUIDE.md`; use aquele arquivo apenas para host/porta/schema. A senha nunca deve ser copiada para o código.

---

## 3. Fase 0 — inspeção antes de modificar

Clone o repositório oficial e leia a documentação antes de editar:

```bash
git clone https://github.com/IvanMHonemann/gestao-extintores.git
cd gestao-extintores

cat README.md
cat PORTABILITY.md
cat AI_HANDOFF.md
cat DATABASE_MIGRATION_GUIDE.md
cat DEPLOYMENT.md
cat OPERATIONS.md
```

Confirme:

```bash
git remote -v
git branch --show-current
git status --short
find . -maxdepth 2 -type f | sort
```

O remote principal esperado é:

```text
https://github.com/IvanMHonemann/gestao-extintores.git
```

Se houver alterações locais, não as apague. Pare, faça backup do trabalho local e informe o conflito.

Antes de qualquer mudança, verifique que não existem secrets versionados:

```bash
find . -path './node_modules' -prune -o -path './dist' -prune -o -path './.git' -prune -o -type f \( -name '.env' -o -name '.env.*' -o -name '*backup*' -o -name '*.sql.gz' \) -print
git diff --check
```

---

## 4. Fase 1 — backup seguro antes da troca

Faça o backup **fora do repositório** e com permissão restrita:

```bash
mkdir -p /var/backups/gestao-extintores
pnpm install --frozen-lockfile
pnpm backup:db -- --output=/var/backups/gestao-extintores/pre-migration-$(date +%Y%m%d%H%M%S).json
chmod 600 /var/backups/gestao-extintores/pre-migration-*.json
```

Confirme apenas o caminho, modo e tamanho do arquivo. Não imprima o conteúdo do backup no terminal e não o versione.

Se a hospedagem não permitir `/var/backups`, use um diretório privado fora do projeto, com criptografia e controle de acesso.

Não restaure o backup durante a migração normal. A restauração só deve ser feita se houver falha comprovada e após decisão explícita.

---

## 5. Fase 2 — conectar GitHub sem conexões erradas

Autentique a GitHub CLI sem colocar token em comando, arquivo ou prompt:

```bash
gh auth login
gh auth status
gh repo view IvanMHonemann/gestao-extintores --json nameWithOwner,isPrivate,defaultBranchRef,url
git remote -v
```

O repositório deve ser privado. Para conectar uma cópia local a outro repositório privado autorizado:

```bash
./scripts/git-connect.sh OWNER/NOVO_REPOSITORIO --private
```

Se o script não estiver executável:

```bash
bash ./scripts/git-connect.sh OWNER/NOVO_REPOSITORIO --private
```

Nunca passe senha ou token como argumento. Nunca faça force-push. Se o remote tiver commits que não existem localmente:

```bash
git fetch --all --prune
git log --oneline --decorate --all -20
git diff --stat HEAD...github/main
```

Compare antes de integrar. Preserve ambos os históricos; não descarte o histórico remoto silenciosamente.

---

## 6. Fase 3 — configurar o ambiente sem versionar secrets

Crie o `.env` apenas localmente ou cadastre os valores no secret manager:

```bash
cp config/env.example .env
```

Preencha somente no ambiente protegido:

```dotenv
EXTERNAL_DATABASE_URL=...
JWT_SECRET=...
MANUS_INTEGRATIONS=false
PORT=3000
```

Confirme que `.env` está ignorado:

```bash
git check-ignore -v .env
```

Em Docker, passe secrets por `env_file` privado, secrets da plataforma ou variáveis do serviço. Não edite `Dockerfile` ou `docker-compose.yml` com credenciais reais.

---

## 7. Fase 4 — validar o banco existente em modo somente leitura

Antes de qualquer migração, confirme que a aplicação consegue conectar:

```bash
pnpm exec vitest run server/external-db.test.ts
```

Também valide somente metadados, sem alterar tabelas:

- banco/schema correto;
- tabelas `companies`, `member_accounts`, `platform_admins`, `member_sessions`, `clients`, `extinguishers`, `service_orders`, `service_order_items`, `trash_items` e `system_settings`;
- colunas da versão do código presentes;
- chaves estrangeiras e tenant/account IDs presentes;
- diário de migrações compatível.

Se qualquer tabela/coluna esperada estiver ausente, **não rode migração automaticamente**. Gere um relatório com:

```text
schema local esperado
schema real encontrado
comandos/migração proposta
risco
plano de rollback
```

O banco atual é a fonte de verdade dos dados. Preserve `drizzle/schema.ts` e todos os arquivos de migração versionados. Não substitua a pasta `drizzle/` por uma versão parcial do ZIP.

---

## 8. Fase 5 — instalar e validar o código

Execute exatamente:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
pnpm test -- --run
pnpm run build
```

Depois execute o CI local:

```bash
./scripts/ci-local.sh
```

O resultado esperado é:

- TypeScript sem erros;
- todos os testes passando;
- build de frontend e servidor concluído;
- nenhum erro de importação;
- nenhum erro de schema durante o startup.

Warnings de tamanho de chunk devem ser registrados, mas não tratados com alteração estrutural arriscada durante a migração.

---

## 9. Fase 6 — iniciar o servidor corretamente

Para produção ou preview estável:

```bash
NODE_ENV=production pnpm start
```

Ou:

```bash
docker compose up -d --build
```

Valide localmente:

```bash
curl -fsS http://127.0.0.1:3000/ >/dev/null
curl -fsS http://127.0.0.1:3000/manifest.json >/dev/null
```

O servidor deve servir `dist/public`, e não depender de websocket HMR ou `localhost:5173`.

Se aparecer tela branca:

1. verificar status HTTP do `index.html`;
2. verificar se `dist/public` existe;
3. verificar caminho usado pelo Express em produção;
4. verificar console do navegador;
5. confirmar que o bundle não contém `@vite/client`, `html-proxy` ou websocket de desenvolvimento;
6. reconstruir com `pnpm run build`;
7. não corrigir alterando o login ou apagando o banco.

---

## 10. Fase 7 — checklist funcional sem perder dados

Use uma conta real existente no ambiente protegido. Não exiba senha em logs.

Teste nesta ordem:

1. Login do administrador geral.
2. Login de um usuário de empresa.
3. Logout e bloqueio das rotas protegidas.
4. Seleção de empresa ativa pelo administrador geral.
5. Cadastro de cliente na empresa selecionada.
6. Cadastro de extintor ligado ao cliente.
7. Criação de OS ligada ao cliente.
8. Formas de pagamento À VISTA, PIX, CRÉDITO, PARCELADO e BOLETO.
9. Parcelas aparecendo somente quando aplicável.
10. Observações aparecendo na visualização e no PDF.
11. Listagem da OS após recarregar.
12. Impressão/PDF da OS.
13. Compartilhamento do PDF no celular por `navigator.share` quando disponível.
14. Menu lateral responsivo em celular e desktop.
15. Lixeira visível para `company_admin`.
16. Lixeira visível para `platform_admin` com seletor de empresa.
17. OS, clientes e extintores excluídos aparecendo na lixeira correta.
18. Restauração de item e confirmação de retorno ao sistema.
19. Exclusão permanente de item e confirmação de que não pode mais ser restaurado.
20. Isolamento: uma empresa nunca deve ver registros de outra.
21. Atualização offline, restauração de sessão offline e retorno da conexão.
22. PWA, service worker e atualização do bundle.

Para smoke tests que escrevem no banco, use identificadores únicos com prefixo `VALIDACAO`, registre os IDs criados e execute a limpeza no bloco `finally`. Confirme ao final que nenhum registro de teste permaneceu.

---

## 11. Regras específicas do sistema que não podem ser quebradas

- Usuários comerciais usam login próprio da aplicação.
- `platform_admin` não deve ser bloqueado por ausência de `tenantKey`/`companyId` na sessão; ele escolhe a empresa nas operações globais.
- Dados comerciais sempre carregam `accountId`/empresa e devem ser filtrados por tenant.
- Procedures globais usam `platform.data.*`.
- Depois de criar/editar/excluir uma OS global, invalidar/recarregar `platform.data.orders` da empresa selecionada.
- A lixeira usa `trash_items`, snapshots e retenção automática de 24 horas.
- Restauração deve normalizar timestamps JSON para `Date` antes de inserir em colunas MySQL `timestamp`.
- A exclusão permanente deve exigir confirmação e respeitar o tenant selecionado.
- O service worker deve ser versionado quando o bundle mudar para evitar cache antigo.
- Não alterar a tela de login, método de autenticação ou fluxo offline sem solicitação específica.
- Não usar links `wa.me` como substituto do compartilhamento de arquivo PDF no celular.

---

## 12. GitHub Actions e produção

No repositório, configure apenas o necessário:

- `EXTERNAL_DATABASE_URL` como secret do GitHub Actions, preferencialmente com credencial limitada/read-only para smoke test;
- nenhum secret no código;
- CI rodando check, testes e build;
- smoke test de banco manual/read-only;
- container publicado no GHCR apenas após CI verde.

Imagem esperada:

```text
ghcr.io/ivanmhonemann/gestao-extintores:latest
```

O host de produção deve fornecer fora da imagem:

```text
EXTERNAL_DATABASE_URL
JWT_SECRET
PORT
MANUS_INTEGRATIONS=false
```

Push no GitHub não publica automaticamente a hospedagem Manus/WebDev. A prévia e o domínio público podem pertencer a contas diferentes; compare sempre a URL atual antes de publicar.

---

## 13. Publicar alterações somente depois do CI

```bash
./scripts/ci-local.sh
git diff --check
git status --short
git add -A
git commit -m "descreva a alteração"
git push github main
git status --short
git log -1 --oneline
```

Antes do push, confirme novamente que nenhum `.env`, backup, token, URL com senha ou dado real está no commit.

Depois do push:

```bash
gh run list --limit 5
gh repo view IvanMHonemann/gestao-extintores --json nameWithOwner,isPrivate,defaultBranchRef,url
```

---

## 14. Relatório obrigatório antes de concluir

Não diga apenas “migração concluída”. Entregue um relatório com:

```text
[ ] Repositório/remote GitHub confirmado
[ ] Branch e commit final
[ ] Banco existente confirmado — sem banco novo
[ ] Secrets configurados fora do código
[ ] Senha antiga rotacionada ou pendência explicitada
[ ] Backup criado, caminho e permissão
[ ] Schema comparado em modo read-only
[ ] Migração de schema executada? Qual e por quê?
[ ] Typecheck
[ ] Testes e quantidade
[ ] Build
[ ] Smoke test de login
[ ] Smoke test de cliente/extintor/OS
[ ] Isolamento multi-tenant
[ ] Lixeira, restauração e exclusão permanente
[ ] Offline/PWA
[ ] PDF/impressão/compartilhamento
[ ] CI GitHub
[ ] URL/host atual validado
[ ] Pendências e rollback
```

Se algum item falhar, informe exatamente o erro, o que foi preservado e o próximo passo seguro. Não esconda falhas e não marque como concluído apenas porque o build passou.

**Fim do prompt.**
