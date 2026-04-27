ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS default_subscription_fee_monthly numeric NOT NULL DEFAULT 0;