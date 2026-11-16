# Portal do Consultor no Easypanel

## Serviço

- Tipo: App
- Fonte: Upload
- Builder: Dockerfile
- Dockerfile: `Dockerfile`
- Porta interna: `3000`
- Protocolo: HTTP
- Réplicas iniciais: `1`
- Healthcheck: `/api/health`

## Variáveis obrigatórias

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_APP_URL=https://portal.seudominio.com.br
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard/overview
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard/overview

SIPROV_ENABLED=true
SIPROV_API_BASE_URL=https://acesso.siprov.com.br/siprov-api
SIPROV_USERNAME=
SIPROV_PASSWORD=
SIPROV_TIMEOUT_MS=60000
SIPROV_FALLBACK_TO_DEMO=false
SIPROV_MONTHLY_TARGET=25
SIPROV_SALES_START_DATE=01/01/2024
SIPROV_DELINQUENCY_START_DATE=01/01/2024

DATABASE_URL=postgresql://usuario:senha@servico-postgres:5432/portal_consultor
DATABASE_SSL=false
SIPROV_WEBHOOK_SECRET=
SIPROV_SYNC_SECRET=

NEXT_PUBLIC_SENTRY_DISABLED=true
```

As variáveis `SIPROV_TEST_*` são exclusivas dos testes locais e não devem ser configuradas no serviço de produção.

Os dois segredos devem ser diferentes e ter pelo menos 32 caracteres. Eles podem ser gerados com:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Sincronização com a Siprov

O portal cria as tabelas no PostgreSQL automaticamente no primeiro gatilho ou sincronização.
Cadastre no Siprov, em `Ferramenta > Sistema > Gatilhos`, as URLs abaixo substituindo
`SEGREDO` pelo valor exato de `SIPROV_WEBHOOK_SECRET`:

```text
https://portal.seudominio.com.br/api/webhooks/siprov/beneficio/SEGREDO
https://portal.seudominio.com.br/api/webhooks/siprov/titulo/SEGREDO
```

Faça a carga inicial uma única vez, usando o segredo de sincronização no cabeçalho:

```bash
curl -X POST "https://portal.seudominio.com.br/api/siprov/sync" \
  -H "Authorization: Bearer SEU_SIPROV_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"initial","startDate":"2024-01-01","endDate":"2026-11-16"}'
```

Depois, configure no n8n uma chamada diária para a mesma rota com:

```json
{"mode":"daily","days":2}
```

Essa reconciliação cobre os dois últimos dias; os gatilhos mantêm as alterações em tempo real.

## Validação

Depois do deploy:

1. Abra `/api/health` e confirme `status: ok`.
2. Entre com um usuário do Clerk.
3. Confirme o selo `Dados oficiais Siprov`.
4. Valide um consultor e um representante.
5. Verifique os logs para respostas `401`, `429` ou timeouts da Siprov.
