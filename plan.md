# Plano de reforço de segurança do Extinfy

## Objetivo
Implementar os requisitos P0, P1 e P2 do PRD `PRD_seguranca_extinfy.md` sem criar banco novo, preservando o TiDB existente, os dados multiempresa e o checkout hospedado da Asaas.

## Fases
1. **P0 rápido:** headers/CSP, cookie de sessão seguro, CSRF por Origin/Referer, limite de corpo, validação de ambiente e pipeline básico.
2. **P0 abuso:** rate limit distribuído em TiDB, proteção de login/cadastro/recuperação/webhook, política de senha e validações do webhook.
3. **P1:** sessão deslizante/revogação global, auditoria de segurança, defesa IDOR, limpeza de cache no logout, validação de arquivos/textos e 2FA/TOTP para administradores.
4. **P1/P2:** backups criptografados e retenção, LGPD (termos, privacidade, consentimento, exportação/exclusão), monitoramento, security.txt e runbook de incidente.

## Estrutura
- `server/security.ts`: headers, origem/CSRF, redação e validação de ambiente.
- `server/rateLimit.ts`: contador distribuído por chave/janela no TiDB, com fallback somente para testes sem banco.
- `server/memberAuth.ts`: política de senha, sessões e revogação.
- `server/asaas.ts` e `server/vercel-entry.ts`: integração, autenticação e idempotência do webhook.
- `server/routers.ts`: limites e validações de entrada tRPC.
- `drizzle/schema.ts` e `drizzle/*.sql`: migrações aditivas e reversíveis.
- `public/`: documentos LGPD, security.txt e manifestos públicos.
- `.github/workflows/`: typecheck, testes, audit e varredura de segredos.

## Restrições
Nenhum número de cartão passa pelo sistema. Segredos ficam somente no secret manager. Dados existentes não são apagados nem migrados destrutivamente. Contas antigas permanecem utilizáveis enquanto recebem reforços graduais.

## Verificação
Typecheck, build, testes Vitest de isolamento/CSRF/rate limit/sessões/webhook, `pnpm audit --prod`, varredura de segredos e inspeção dos headers publicados.
