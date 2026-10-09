# Segurança do Extinfy — critérios de aceitação

- [ ] **R1 Rate limit persistente:** substituir o `Map` em memória por armazenamento compartilhado; aplicar por IP e conta: login 5 falhas/15 min por e-mail e 20/15 min por IP; recuperação 3/hora por e-mail e IP; cadastro 5/hora por IP; planos públicos 60/min por IP; tRPC autenticado 300/min por usuário; responder 429 com `Retry-After` e manter mensagem de login genérica.
- [ ] **R2 Headers e CSP:** HSTS de um ano com includeSubDomains, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors none, X-Frame-Options DENY e CSP restritiva; landing sem script inline inseguro.
- [ ] **R3 Sessão/CSRF:** produção usa cookie `__Host-`, HttpOnly, Secure, SameSite=Lax/Strict; preview cross-site é controlado por variável; mutações POST tRPC rejeitam Origin/Referer estranho com 403.
- [ ] **R4 DoS:** corpo padrão de 1 MB, webhook de 100 KB, limites Zod para strings/listas e timeout/limites documentados.
- [ ] **R5 Cadastro:** captcha servidor, verificação de e-mail, teste único normalizado, descartáveis bloqueados e resposta neutra.
- [ ] **R6 Senhas:** mínimo 10 caracteres, comuns/vazadas bloqueadas, sem senha igual ao e-mail/empresa, custo scrypt reforçado/rehash, invalidação global de sessões e recuperação por link de uso único.
- [ ] **R7 Asaas:** token obrigatório em produção, idempotência, externalReference/empresa/plano/valor conferidos, limite de corpo, rate limit e rejeições auditadas.
- [ ] **R8 Configuração:** ambiente validado em produção, sem defaults inseguros, `.env*` ignorado, CI com varredura e ambientes separados.
- [ ] **R9 2FA:** TOTP obrigatório para administradores da plataforma, códigos de recuperação com hash e uso único.
- [ ] **R10 Sessões:** idle 12h, absoluta 14d, rotação, lista/revogação global e limpeza de cache no logout.
- [ ] **R11 Multi-tenant:** todas as procedures filtram pelo tenant do contexto e suíte IDOR cobre clientes, extintores, OS, lixeira, backup, importação, impressão/PDF.
- [ ] **R12 Auditoria:** login/falha/logout, senha, perfis, usuários, plano, assinatura, exportação/backup e ações de plataforma registram IP/user-agent sem segredos.
- [ ] **R13 Backups:** AES-256, chave fora do repositório, retenção 30 diárias + 12 mensais, acesso restrito, restauração testada e documentada.
- [ ] **R14 Pipeline:** audit de produção falha em high/critical, Dependabot, secrets scan, lint, typecheck, testes e Node LTS.
- [ ] **R15 Arquivos/XSS:** magic bytes, tamanho/extensão, nomes seguros, nosniff/Content-Disposition e nenhum HTML de usuário sem sanitização.
- [ ] **R16 LGPD:** Termos/Privacidade públicos, consentimento versionado, exportação/exclusão, retenção, encarregado/canal e plano de incidentes.
- [ ] **R17–R20 Evolução:** anomalias, bloqueio de IP, chaves escopadas/rotacionáveis, pentest independente, `security.txt` e política de senha configurável.
