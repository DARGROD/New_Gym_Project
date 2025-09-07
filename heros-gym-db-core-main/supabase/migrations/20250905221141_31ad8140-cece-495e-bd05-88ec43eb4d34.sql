-- Add payments column to memberships table
ALTER TABLE public.memberships 
ADD COLUMN payments text DEFAULT 'cash';

-- Drop the payments table as it's no longer needed
DROP TABLE IF EXISTS public.payments;