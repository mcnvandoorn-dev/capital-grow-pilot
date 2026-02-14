
ALTER TABLE public.private_investments
  ADD COLUMN has_loan boolean NOT NULL DEFAULT false,
  ADD COLUMN loan_amount numeric DEFAULT NULL,
  ADD COLUMN loan_interest_rate numeric DEFAULT NULL,
  ADD COLUMN loan_monthly_payment numeric DEFAULT NULL;
