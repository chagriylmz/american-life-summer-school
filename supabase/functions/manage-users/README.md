# manage-users Edge Function

Secure admin-only user management for American Life Sancaktepe Campus Portal.

## Required Supabase function environment

The function reads these server-side variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not add these to any `VITE_` frontend environment variable.

## Deploy

```bash
supabase functions deploy manage-users
```

## Supported actions

- `listUsers`
- `createUser`
- `updateUser`

Only active users whose `public.users.role` is `admin` can call these actions.
