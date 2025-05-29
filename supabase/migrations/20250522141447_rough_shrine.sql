/*
  # Remove redundant payment_method column

  1. Changes
    - Remove the `payment_method` column from the `quotes` table since it's redundant with the `payment_methods` array
    - The `payment_methods` array column is already being used to store payment method information

  2. Reasoning
    - The `payment_method` column is causing NOT NULL constraint violations
    - Payment methods are now stored in the `payment_methods` JSONB array column
    - The single `payment_method` column is no longer needed
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'quotes' 
    AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE quotes DROP COLUMN payment_method;
  END IF;
END $$;