# Relatório de independência — Gestão de Extintores

**Data:** 2026-09-28

## Resultado

O caminho de produção foi desacoplado de serviços específicos de uma hospedagem. Login comercial, API, banco, sessões, backups, manutenção e alertas agora possuem contratos portáveis.

## Alterações realizadas

- Removidos OAuth, SDK, heartbeat, storage proxy, notificações, IA, transcrição e mapas proprietários não utilizados.
- Storage reduzido a S3 compatível: AWS S3, Cloudflare R2, MinIO, Backblaze ou equivalente.
- Cron de manutenção protegido por `SCHEDULE_SECRET`, utilizável por qualquer scheduler HTTP.
- Alertas convertidos para `ALERT_WEBHOOK_URL` genérico.
- Mapa usa somente `VITE_GOOGLE_MAPS_API_KEY` direto e permanece opcional.
- Removidos plugin de debug, metadata e template específicos da plataforma.
- Guias de portabilidade, deployment, banco e operação atualizados.

## Validação

- TypeScript, build e suíte completa devem ser executados no release final.
- A suíte CI usa banco separado e fixtures determinísticas de duas empresas.
- A auditoria de referências proprietárias deve permanecer vazia em código, configuração e documentação operacional.

## Pendências de infraestrutura

A nova hospedagem precisa fornecer seus próprios secrets (`EXTERNAL_DATABASE_URL`, `JWT_SECRET`, `SCHEDULE_SECRET` e, se desejado, `S3_*`) e configurar HTTPS, cron e observabilidade. Isso é configuração da infraestrutura, não dependência do código.
