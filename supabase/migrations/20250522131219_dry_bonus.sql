/*
  # Initial OrcVitta Schema

  1. Tables
    - profiles
      - id (uuid, references auth.users)
      - full_name (text)
      - unit (text)
      - created_at (timestamp)
    
    - vaccines
      - id (uuid)
      - name (text)
      - manufacturer (text)
      - stock (integer)
      - price (decimal)
      - created_at (timestamp)
    
    - clients
      - id (uuid)
      - name (text)
      - birth_date (date)
      - city (text)
      - cpf (text, optional)
      - address (text, optional)
      - guardian (text, optional)
      - created_at (timestamp)
    
    - quotes
      - id (uuid)
      - client_id (uuid, references clients)
      - created_by (uuid, references profiles)
      - status (text)
      - payment_method (text)
      - discount (decimal)
      - notes (text)
      - created_at (timestamp)
    
    - quote_items
      - id (uuid)
      - quote_id (uuid, references quotes)
      - vaccine_id (uuid, references vaccines)
      - quantity (integer)
      - price (decimal)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create tables
CREATE TABLE profiles (
  id uuid REFERENCES auth.users PRIMARY KEY,
  full_name text NOT NULL,
  unit text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE vaccines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manufacturer text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  price decimal NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  birth_date date NOT NULL,
  city text NOT NULL,
  cpf text,
  address text,
  guardian text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients NOT NULL,
  created_by uuid REFERENCES profiles NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL,
  discount decimal DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes NOT NULL,
  vaccine_id uuid REFERENCES vaccines NOT NULL,
  quantity integer NOT NULL,
  price decimal NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccines ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view all vaccines"
  ON vaccines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage vaccines"
  ON vaccines FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Users can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Users can view all quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage quotes"
  ON quotes FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Users can view all quote items"
  ON quote_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage quote items"
  ON quote_items FOR ALL
  TO authenticated
  USING (true);

-- Create function to update vaccine stock
CREATE OR REPLACE FUNCTION update_vaccine_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE vaccines v
    SET stock = v.stock - qi.quantity
    FROM quote_items qi
    WHERE qi.quote_id = NEW.id AND qi.vaccine_id = v.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock update
CREATE TRIGGER update_stock_on_quote_approval
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION update_vaccine_stock();