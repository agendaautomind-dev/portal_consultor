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
SIPROV_SKIP_VENDOR_VALIDATION=false

NEXT_PUBLIC_SENTRY_DISABLED=true
```

As variáveis `SIPROV_TEST_*` são exclusivas dos testes locais e não devem ser configuradas no serviço de produção.

## Validação

Depois do deploy:

1. Abra `/api/health` e confirme `status: ok`.
2. Entre com um usuário do Clerk.
3. Confirme o selo `Dados oficiais Siprov`.
4. Valide um consultor e um representante.
5. Verifique os logs para respostas `401`, `429` ou timeouts da Siprov.
