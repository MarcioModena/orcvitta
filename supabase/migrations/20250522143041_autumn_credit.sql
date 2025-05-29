/*
  # Add phone number to clients table

  1. Changes
    - Add phone column to clients table with Brazilian phone number format
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'phone'
  ) THEN
    ALTER TABLE clients ADD COLUMN phone TEXT;
  END IF;
END $$;