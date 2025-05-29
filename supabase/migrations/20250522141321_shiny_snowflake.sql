/*
  # Add payment methods column to quotes table

  1. Changes
    - Add payment_methods column to quotes table as JSONB array
    - This column will store an array of payment method objects with method and discount
    - Set default value as empty array

  2. Notes
    - Uses JSONB for flexible payment method storage
    - Each payment method object will have: { method: string, discount: number }
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'payment_methods'
  ) THEN
    ALTER TABLE quotes 
    ADD COLUMN payment_methods JSONB[] DEFAULT '{}';
  END IF;
END $$;