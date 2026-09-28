# CI/CD e publicação

## O que acontece automaticamente

Todo push para `main` e todo pull request executam o workflow `CI`. Ele instala o projeto com o lockfile, executa TypeScript, testes isolados de autenticação e build de produção. Nenhum job de CI escreve no banco.

Quando o workflow `CI` termina com sucesso no branch `main`, o workflow `Container` constrói e publica uma imagem versionada no GitHub Container Registry. As tags são `latest` e o SHA do commit. A imagem contém o servidor e o frontend compilado, mas não contém secrets, banco ou backups.

O workflow `Database smoke test` é manual. Ele usa o secret `EXTERNAL_DATABASE_URL` do repositório e executa somente a consulta de conectividade já existente. Não coloque a URL no código, nos logs ou em arquivos versionados.

## Como cadastrar o secret do banco

No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e crie `EXTERNAL_DATABASE_URL`. Para o ambiente atual, a URL deve apontar para o schema TiDB `test` em `gateway01.sa-east-1.prod.aws.tidbcloud.com:4000`; nunca use o schema de sistema `sys`. Use uma credencial de leitura ou uma credencial limitada para o smoke test, se possível. A URL completa e a senha devem permanecer somente no secret manager; o runtime e o Drizzle Kit exigem TLS validado.

## Publicação da aplicação

A pipeline produz uma imagem pronta para hospedagem externa:

```text
ghcr.io/ivanmhonemann/gestao-extintores:latest
```

O host de produção deve executar essa imagem com `EXTERNAL_DATABASE_URL`, `JWT_SECRET`, `PORT` e demais secrets configurados fora da imagem. Nunca grave esses valores em `docker-compose.yml`, no GitHub ou no Dockerfile.

A hospedagem Manus/WebDev atual continua sendo gerenciada pela plataforma e não recebe deploy automático do GitHub apenas por existir este workflow. Para ativar deploy contínuo nela, seria necessário um mecanismo oficial de integração e credenciais de deploy da própria hospedagem. Sem isso, o fluxo seguro é validar e publicar a imagem no GitHub e promover a versão no host escolhido.

## Fluxo operacional

1. Criar uma branch e abrir pull request.
2. Aguardar o CI passar.
3. Revisar e fazer merge em `main`.
4. Confirmar que a imagem `latest` foi publicada no GHCR.
5. Fazer backup privado antes de qualquer migração de schema.
6. Gerar e revisar o SQL; aplicar somente com `pnpm exec drizzle-kit push --strict` após autorização explícita.
7. Promover a imagem no host de produção, mantendo o mesmo banco externo.
8. Rodar o smoke test manual após a publicação.

Migrações de banco continuam sendo uma operação separada, revisada e protegida por backup. O CI não deve executar `db:push`, `drizzle-kit migrate` ou SQL destrutivo automaticamente contra produção. Consulte `DATABASE_MIGRATION_GUIDE.md` para o fluxo completo.
