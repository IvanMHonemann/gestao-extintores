# Prompt mestre — migração segura do Gestão de Extintores

> **Uso:** copie todo o bloco abaixo e envie para a outra conta ou IA. Execute as fases na ordem. Não invente credenciais, domínios, banco, permissões ou resultados. Se houver divergência crítica, pare e relate antes de editar.

---

## PROMPT PARA A OUTRA CONTA/IA

Você é responsável por assumir, migrar e continuar a manutenção do projeto **Gestão de Extintores**. O projeto é um sistema full-stack multi-tenant para empresas cadastrarem clientes, extintores, alertas de validade e ordens de serviço.

### Objetivo principal

Colocar o projeto em funcionamento nesta nova conta ou hospedagem preservando:

- o código atual do GitHub;
- o banco MySQL/TiDB existente e todos os dados reais;
- o login próprio por e-mail e senha;
- o administrador global `platform_admin`;
- o isolamento rigoroso por empresa/`accountId`;
- o funcionamento offline-first/PWA;
- a fila de sincronização de operações offline;
- clientes, extintores, alertas, OS, usuários, empresas, configurações e lixeira;
- geração, impressão e compartilhamento de documentos de OS;
- paginação e filtros server-side das listas;
- a infraestrutura de produção com bundle estático, sem HMR.

**Não crie outro banco. Não faça seed em produção. Não apague ou substitua dados existentes.**

O ambiente WebDev atual usa o TiDB Cloud em `gateway01.sa-east-1.prod.aws.tidbcloud.com:4000`, schema `test`. A URL completa é um secret; TLS com validação de certificado é obrigatório. Nunca use o schema de sistema `sys` para a aplicação.

---

## 1. Regras obrigatórias

1. **GitHub guarda código; MySQL/TiDB guarda dados.** Nunca copie dados reais para commits.
2. Nunca versione `.env`, senhas, tokens, cookies, sessões, backups, dumps ou URLs de banco com senha.
3. Use `EXTERNAL_DATABASE_URL` para conectar ao banco existente. `DATABASE_URL` só pode ser fallback se o runtime exigir.
4. Fora da Manus, use `MANUS_INTEGRATIONS=false`. O login comercial próprio não deve depender de Manus OAuth.
5. Preserve o `JWT_SECRET` atual somente se for necessário manter sessões existentes. Se trocar, informe que as sessões serão invalidadas.
6. Nunca execute `DROP`, `TRUNCATE`, delete amplo, restauração destrutiva ou migração de schema sem backup recente e autorização explícita.
7. Não execute `pnpm db:push` ou `drizzle-kit migrate` automaticamente contra produção. Primeiro faça backup, compare o schema local com o banco real, gere/revise o SQL e aplique somente com `pnpm exec drizzle-kit push --strict` após autorização explícita.
8. Nunca faça `git push --force`.
9. Não use Vite HMR, websocket de desenvolvimento, `localhost:5173` ou `@vite/client` em produção/preview. O servidor deve servir `dist/public`.
10. Não altere o layout de login, o método de autenticação, o isolamento por tenant ou o fluxo offline sem solicitação específica.
11. Não mostre senhas de usuários. Use redefinição segura de senha.
12. Não marque uma etapa como concluída apenas porque o build passou; valide o comportamento correspondente.

---

## 2. Repositório e documentação

Repositório oficial atual:

```text
https://github.com/IvanMHonemann/gestao-extintores.git
```

Clone e leia primeiro:

```bash
git clone https://github.com/IvanMHonemann/gestao-extintores.git
cd gestao-extintores

cat README.md
cat AI_HANDOFF.md
cat PORTABILITY.md
cat DATABASE_MIGRATION_GUIDE.md
cat DEPLOYMENT.md
cat OPERATIONS.md
```

Confirme o estado antes de editar:

```bash
git remote -v
git branch --show-current
git status --short
git log --oneline --decorate -10
```

Se houver alterações locais, não as apague. Faça backup do trabalho local e informe o conflito.

O estado atual contém, entre outras, estas entregas já implementadas:

- login próprio e sessão independente;
- multi-tenancy com administrador global;
- PWA offline-first com IndexedDB/Dexie;
- fila de mutações offline e sincronização ao reconectar;
- criação offline explícita de clientes e OS;
- lixeira com restauração e exclusão permanente;
- documentos profissionais de OS com observações;
- PIX, CRÉDITO, PARCELADO e BOLETO;
- paginação e filtros server-side para clientes, extintores, alertas e OS;
- service worker versionado para atualização do bundle.

O commit mais recente da correção offline é `e789b10`. Não force o uso desse hash se o GitHub tiver uma versão mais nova; compare os históricos antes de integrar.

---

## 3. Secrets: configure somente no secret manager

Solicite ao responsável os valores, mas nunca os escreva no Git:

```text
EXTERNAL_DATABASE_URL=<URL do banco atual com senha nova e TLS>
DATABASE_URL=<opcional, se o host exigir fallback>
JWT_SECRET=<segredo longo>
MANUS_INTEGRATIONS=false
PORT=3000
```

No ambiente atual, `EXTERNAL_DATABASE_URL` deve apontar para `/test`. Nunca registre a URL completa, senha ou certificados no Git.

O opcional somente se realmente utilizado:

```text
VITE_GOOGLE_MAPS_API_KEY=<chave do mapa>
```

Crie o ambiente apenas localmente ou no secret manager:

```bash
cp config/env.example .env
git check-ignore -v .env
```

A senha do banco usada em qualquer ambiente anterior deve ser considerada potencialmente exposta e deve ser rotacionada no provedor antes da migração.

---

## 4. Backup e banco existente

Antes de alterar schema ou trocar de hospedagem:

```bash
mkdir -p /var/backups/gestao-extintores
pnpm install --frozen-lockfile
pnpm backup:db -- --output=/var/backups/gestao-extintores/pre-migration-$(date +%Y%m%d%H%M%S).json
chmod 600 /var/backups/gestao-extintores/pre-migration-*.json
```

Se `/var/backups` não existir, use um diretório privado fora do repositório.

Não imprima o conteúdo do backup no terminal e não o versione.

Antes de migrar schema, confira somente metadados e a conectividade. Espera-se encontrar tabelas equivalentes a:

```text
companies
member_accounts
platform_admins
member_sessions
clients
extinguishers
service_orders
service_order_items
trash_items
system_settings
```

Se faltar tabela, coluna, índice ou relacionamento, pare e produza este relatório:

```text
Schema esperado:
Schema encontrado:
Diferença:
Risco para os dados:
Migração proposta:
Backup disponível:
Plano de rollback:
```

Não corrija divergência de banco por tentativa e erro.

Depois de editar `drizzle/schema.ts`, execute `pnpm exec drizzle-kit generate`, leia integralmente o SQL e só então use `pnpm exec drizzle-kit push --strict`. Os arquivos históricos em `drizzle/0000`–`drizzle/0006` contêm transformações de dados e não devem ser aplicados em sequência como baseline de um banco vazio.

---

## 5. GitHub em outra conta

Autentique sem colocar token em comandos ou arquivos:

```bash
gh auth login
gh auth status
gh repo view IvanMHonemann/gestao-extintores --json nameWithOwner,isPrivate,defaultBranchRef,url
git remote -v
```

Para conectar a um novo repositório privado autorizado:

```bash
bash ./scripts/git-connect.sh OWNER/NOVO_REPOSITORIO --private
```

Se o remote tiver commits diferentes:

```bash
git fetch --all --prune
git log --oneline --decorate --all -20
git diff --stat HEAD...github/main
```

Compare antes de integrar. Preserve os dois históricos; não sobrescreva silenciosamente o remoto.

---

## 6. Instalação e validação inicial

Execute:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
pnpm test -- --run
pnpm run build
```

Se existir o script, execute também:

```bash
bash ./scripts/ci-local.sh
```

Resultado mínimo esperado:

- TypeScript sem erros;
- todos os testes passando;
- frontend e servidor compilados;
- `dist/public/index.html` existente;
- `dist/index.js` existente;
- nenhum secret versionado;
- nenhum erro de importação;
- nenhum erro de schema no startup.

Warnings de tamanho de bundle devem ser registrados, não tratados com refatoração arriscada durante a migração.

---

## 7. Inicialização correta

Produção/preview estável:

```bash
NODE_ENV=production pnpm start
```

Ou Docker:

```bash
docker compose up -d --build
docker compose logs -f app
```

Valide:

```bash
curl -fsS http://127.0.0.1:3000/ >/dev/null
curl -fsS http://127.0.0.1:3000/manifest.json >/dev/null
```

O servidor deve servir o bundle de `dist/public`. Se houver tela branca:

1. verifique o status HTTP do `index.html`;
2. confirme a existência de `dist/public`;
3. confirme o caminho usado pelo Express em produção;
4. procure erros no console;
5. verifique que o bundle não contém `@vite/client`, `html-proxy` ou websocket HMR;
6. execute novamente `pnpm run build`;
7. não altere o login nem apague o banco para tentar corrigir.

---

## 8. Teste funcional obrigatório

Use contas reais existentes em ambiente protegido. Não registre senhas nos logs.

Teste nesta ordem:

1. Login do administrador global.
2. Login de usuário de empresa.
3. Logout e bloqueio das áreas protegidas.
4. Seleção de empresa pelo administrador global.
5. Cadastro de cliente online.
6. Cadastro de extintor associado ao cliente.
7. Criação de OS online.
8. Observações na OS e no PDF.
9. Formas de pagamento e parcelas condicionais.
10. Impressão e compartilhamento do PDF.
11. Lixeira: exclusão, visualização, restauração e exclusão permanente.
12. Isolamento: empresa A nunca enxerga dados da empresa B.
13. Paginação e filtros de clientes, extintores, alertas e OS.
14. Recarregamento online sem piscar a tela de login.
15. Recarregamento offline mantendo a sessão e os dados.
16. **Modo offline: criar cliente, clicar em salvar e confirmar que aparece imediatamente.**
17. **Modo offline: criar OS para cliente local e confirmar que aparece imediatamente.**
18. Abrir a OS criada offline e confirmar o documento local.
19. Reconectar a Internet e confirmar que clientes/OS entram na fila e são sincronizados.
20. Confirmar que a fila não duplica registros após uma nova sincronização.
21. Atualização automática do PWA e carregamento do bundle novo.

Para testes que escrevem no banco, use prefixo único `VALIDACAO`, registre IDs e remova tudo em `finally`. Não deixe dados de teste.

---

## 9. Regras técnicas que devem ser preservadas

- Dados comerciais sempre carregam `accountId` e são filtrados por tenant.
- Procedures globais ficam em `platform.data.*`.
- `platform_admin` seleciona a empresa nas operações globais.
- O login comercial próprio não depende de OAuth externo quando `MANUS_INTEGRATIONS=false`.
- IndexedDB usa tenant keys; nunca misture dados offline de empresas.
- Criação offline grava imediatamente no IndexedDB e adiciona uma mutation pendente.
- A reconexão reenvia a fila respeitando a ordem e substitui IDs locais negativos pelos IDs reais.
- Clientes devem ser sincronizados antes de OS que dependem deles.
- A lixeira retém itens por 24 horas e respeita o tenant.
- O service worker deve receber nova versão quando o bundle mudar.
- Paginação deve limitar o tamanho máximo por página; não reintroduza carregamento integral das listas em telas de produção.
- Não remova o fallback offline para introduzir paginação online.
- Não use `wa.me` como substituto para compartilhar o arquivo PDF.

---

## 10. Publicação segura

Somente depois do CI local:

```bash
bash ./scripts/ci-local.sh
git diff --check
git status --short
git add -A
git commit -m "descreva a alteração"
git push github main
git status --short
git log -1 --oneline
```

Antes do push, confirme que não existem no commit:

```text
.env
backups
*.sql.gz
senhas
tokens
cookies
URLs de banco com senha
dados reais de clientes
```

O GitHub pode publicar a imagem no GHCR, mas push no GitHub não atualiza automaticamente uma hospedagem Manus/WebDev. A aplicação precisa ser promovida no host escolhido.

---

## 11. Relatório final obrigatório

Responda com um relatório objetivo preenchendo:

```text
[ ] Repositório e remote confirmados
[ ] Branch e commit final
[ ] Banco existente usado; nenhum banco novo criado
[ ] Backup criado fora do repositório
[ ] Schema comparado em modo seguro
[ ] Secrets configurados fora do código
[ ] Senha antiga rotacionada ou pendência informada
[ ] Typecheck aprovado
[ ] Testes aprovados e quantidade
[ ] Build aprovado
[ ] Servidor iniciado sem HMR
[ ] Login online validado
[ ] Login offline validado
[ ] Criação offline de cliente validada
[ ] Criação offline de OS validada
[ ] Sincronização após reconexão validada
[ ] Paginação e filtros validados
[ ] Isolamento multi-tenant validado
[ ] PDF/impressão/compartilhamento validados
[ ] Lixeira validada
[ ] PWA/service worker atualizado
[ ] CI/GitHub validado
[ ] URL do host validada
[ ] Pendências e rollback documentados
```

Se qualquer item falhar, informe o erro exato, o que foi preservado, o risco e o próximo passo seguro. Nunca declare a migração concluída apenas porque o build passou.

**Fim do prompt.**
