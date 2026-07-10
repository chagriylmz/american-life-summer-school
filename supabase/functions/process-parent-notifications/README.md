# Parent Notification SMS Processor

This Supabase Edge Function processes pending rows in `public.notification_logs`.

It is server-side only. Do not put Netgsm credentials in `.env.local`, `VITE_`
variables, or frontend code.

## Required Secrets

Configure these as Supabase Edge Function secrets:

```bash
supabase secrets set SMS_PROVIDER=netgsm
supabase secrets set NETGSM_USERNAME=your_username
supabase secrets set NETGSM_PASSWORD=your_password
supabase secrets set "NETGSM_HEADER=A.LIFE SANCAKTEPE"
supabase secrets set SMS_DRY_RUN=true
```

Keep `SMS_DRY_RUN=true` for the first deployment and test. Dry-run mode does
not contact Netgsm, does not mark rows as sent, and does not store a real
provider message ID.

## SQL Migration

Run this file in Supabase SQL Editor before deploying or invoking the function:

```text
supabase/migrations/20260710100000_add_notification_processing_status.sql
```

It adds the `processing` status, `processing_started_at`, and creates
`public.claim_pending_notification_logs(batch_size integer)`, which atomically
claims pending notification rows using `for update skip locked`. Rows stuck in
`processing` for more than 15 minutes can be claimed again.

## Deploy

```bash
supabase functions deploy process-parent-notifications
```

## Safe Dry-Run Test

Call the function as an authenticated admin or staff user:

```bash
curl -X POST \
  "https://YOUR_PROJECT_REF.functions.supabase.co/process-parent-notifications" \
  -H "Authorization: Bearer ADMIN_OR_STAFF_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchSize":5}'
```

Expected dry-run behavior:

- pending rows are atomically claimed as `processing`
- valid rows are simulated and safely returned to `pending`
- `provider` remains `null`
- `provider_message_id` remains `null`
- `sent_at` remains `null`
- logs clearly show a dry-run/simulated result
- no SMS is sent

## Manual Checklist

1. Run the SQL migration.
2. Set all required secrets with `SMS_DRY_RUN=true`.
3. Deploy `process-parent-notifications`.
4. Create or confirm a `notification_logs` row with `status = 'pending'`.
5. Invoke the function as admin/staff.
6. Confirm the row is returned to `pending` after simulation.
7. Confirm `sent_at is null`.
8. Confirm `provider is null`.
9. Confirm `provider_message_id is null`.
10. Confirm no real SMS is received.
11. Try invoking as a teacher account and confirm the function returns `403`.
12. Try an invalid phone and confirm the row becomes `failed` with a safe error.
