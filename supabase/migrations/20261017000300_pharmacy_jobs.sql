-- Scheduled jobs for the pharmacy module.
create extension if not exists pg_cron;

-- Release stock held by unpaid orders every five minutes.
select cron.schedule('medtrans-expire-unpaid-orders', '*/5 * * * *', $$select public.expire_unpaid_orders()$$);
