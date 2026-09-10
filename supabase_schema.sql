-- Supabase Schema Migration

-- 1. Users Table (extends Supabase Auth)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'pending',
  location_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Staff Roles Table (For admin pre-assignment)
CREATE TABLE public.staff_roles (
  email TEXT PRIMARY KEY,
  name TEXT,
  role TEXT DEFAULT 'pending',
  location_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Branches
CREATE TABLE public.branches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  address TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Drugs (Inventory)
CREATE TABLE public.drugs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  unit TEXT,
  category TEXT,
  central_stock NUMERIC DEFAULT 0,
  branch_stock JSONB DEFAULT '{}'::jsonb,
  cost_price NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  expiry_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Purchases
CREATE TABLE public.purchases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  drug_id TEXT REFERENCES public.drugs(id),
  drug_name TEXT,
  quantity NUMERIC,
  unit_cost_price NUMERIC,
  total_cost_price NUMERIC,
  supplier TEXT,
  invoice_number TEXT,
  expiry_date TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Dispense Records
CREATE TABLE public.dispense_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  drug_id TEXT REFERENCES public.drugs(id),
  drug_name TEXT,
  quantity NUMERIC,
  location_id TEXT,
  dispensed_by TEXT,
  dispensed_by_name TEXT,
  patient_id TEXT,
  prescription_id TEXT,
  selling_price NUMERIC,
  total_amount NUMERIC,
  payment_method TEXT,
  hmo_provider TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Inter Branch Transfers
CREATE TABLE public.inter_branch_transfers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  drug_id TEXT REFERENCES public.drugs(id),
  drug_name TEXT,
  from_location_id TEXT,
  to_location_id TEXT,
  quantity_transferred NUMERIC,
  requested_by TEXT,
  requested_by_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Audits & Disposals
CREATE TABLE public.audits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  drug_id TEXT REFERENCES public.drugs(id),
  drug_name TEXT,
  missing_quantity NUMERIC,
  cost_value NUMERIC,
  selling_value NUMERIC,
  responsible_user_id TEXT,
  reported_by TEXT,
  reported_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.disposals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  drug_id TEXT REFERENCES public.drugs(id),
  drug_name TEXT,
  quantity NUMERIC,
  cost_value NUMERIC,
  reason TEXT,
  notes TEXT,
  reported_by TEXT,
  reported_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Operating Expenses
CREATE TABLE public.operating_expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT,
  amount NUMERIC,
  description TEXT,
  date TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Prescriptions
CREATE TABLE public.prescriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  doctor_id TEXT,
  doctor_name TEXT,
  patient_name TEXT,
  drug_id TEXT REFERENCES public.drugs(id),
  drug_name TEXT,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  status TEXT DEFAULT 'pending',
  target_branch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_branch_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Allow all for now during migration (You can lock this down later)
CREATE POLICY "Allow public all users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow public all staff" ON public.staff_roles FOR ALL USING (true);
CREATE POLICY "Allow public all branches" ON public.branches FOR ALL USING (true);
CREATE POLICY "Allow public all drugs" ON public.drugs FOR ALL USING (true);
CREATE POLICY "Allow public all purchases" ON public.purchases FOR ALL USING (true);
CREATE POLICY "Allow public all dispense_records" ON public.dispense_records FOR ALL USING (true);
CREATE POLICY "Allow public all inter_branch_transfers" ON public.inter_branch_transfers FOR ALL USING (true);
CREATE POLICY "Allow public all audits" ON public.audits FOR ALL USING (true);
CREATE POLICY "Allow public all disposals" ON public.disposals FOR ALL USING (true);
CREATE POLICY "Allow public all operating_expenses" ON public.operating_expenses FOR ALL USING (true);
CREATE POLICY "Allow public all prescriptions" ON public.prescriptions FOR ALL USING (true);

-- Trigger to sync auth.users to public.users on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
