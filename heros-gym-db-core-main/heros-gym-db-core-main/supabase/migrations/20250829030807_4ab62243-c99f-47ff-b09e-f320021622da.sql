-- Hero's Gym Database Schema
-- Combining the best of both approaches with modern PostgreSQL practices

-- Members table (enhanced from clientes)
CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    national_id TEXT NOT NULL UNIQUE, -- cédula
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    birth_date DATE,
    status TEXT CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Membership plans table (enhanced from tipos_membresia)
CREATE TABLE public.membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- código from original
    name TEXT NOT NULL, -- Plan name (Mensual, Trimestral, etc.)
    description TEXT,
    price NUMERIC(12,2) NOT NULL,
    duration_days INTEGER NOT NULL, -- 30, 90, 365
    benefits TEXT[], -- Array of benefits
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Memberships table (enhanced)
CREATE TABLE public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.membership_plans(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT CHECK (status IN ('active', 'expired', 'cancelled', 'frozen')) DEFAULT 'active',
    activation_date TIMESTAMPTZ,
    cancellation_date TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payments table (extracted and enhanced from original membresias)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'check', 'other')) DEFAULT 'cash',
    reference_number TEXT, -- For bank transfers, card transactions, etc.
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT CHECK (status IN ('paid', 'pending', 'overdue', 'cancelled')) DEFAULT 'paid',
    notes TEXT,
    processed_by TEXT, -- Staff member who processed payment
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance table (enhanced from asistencias)
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_out_at TIMESTAMPTZ,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN checked_out_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (checked_out_at - checked_in_at)) / 60
            ELSE NULL 
        END
    ) STORED,
    source TEXT CHECK (source IN ('kiosk', 'admin', 'mobile', 'card')) DEFAULT 'kiosk',
    notes TEXT
);

-- Staff users table (enhanced from usuarios)
CREATE TABLE public.staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to Supabase auth
    username TEXT UNIQUE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'manager', 'trainer', 'receptionist')) DEFAULT 'receptionist',
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    hire_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Member profiles for auth integration (optional)
CREATE TABLE public.member_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, member_id)
);

-- Useful indexes for performance
CREATE INDEX idx_memberships_status_end_date ON public.memberships (status, end_date);
CREATE INDEX idx_payments_payment_date ON public.payments (payment_date);
CREATE INDEX idx_payments_status ON public.payments (status);
CREATE INDEX idx_attendance_checked_in_at ON public.attendance (checked_in_at);
CREATE INDEX idx_attendance_member_date ON public.attendance (member_id, DATE(checked_in_at));
CREATE INDEX idx_members_national_id ON public.members (national_id);
CREATE INDEX idx_members_status ON public.members (status);

-- Enable Row Level Security
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff access
CREATE POLICY "Staff can view all members" ON public.members
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "Staff can manage members" ON public.members
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Members can view their own data
CREATE POLICY "Members can view own profile" ON public.members
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.member_profiles 
        WHERE user_id = auth.uid() AND member_id = members.id
    )
);

-- Membership plans are viewable by authenticated users
CREATE POLICY "Authenticated users can view membership plans" ON public.membership_plans
FOR SELECT TO authenticated
USING (status = 'active');

-- Staff can manage membership plans
CREATE POLICY "Staff can manage membership plans" ON public.membership_plans
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'manager')
    )
);

-- Memberships policies
CREATE POLICY "Staff can view all memberships" ON public.memberships
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "Members can view own memberships" ON public.memberships
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.member_profiles 
        WHERE user_id = auth.uid() AND member_id = memberships.member_id
    )
);

CREATE POLICY "Staff can manage memberships" ON public.memberships
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Payments policies
CREATE POLICY "Staff can view all payments" ON public.payments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "Staff can manage payments" ON public.payments
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Attendance policies
CREATE POLICY "Staff can view all attendance" ON public.attendance
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "Members can view own attendance" ON public.attendance
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.member_profiles 
        WHERE user_id = auth.uid() AND member_id = attendance.member_id
    )
);

CREATE POLICY "Staff can manage attendance" ON public.attendance
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Staff users policies
CREATE POLICY "Staff can view other staff" ON public.staff_users
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "Admins can manage staff" ON public.staff_users
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
);

-- Member profiles policies
CREATE POLICY "Users can view own member profile" ON public.member_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can manage member profiles" ON public.member_profiles
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_users 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_membership_plans_updated_at
    BEFORE UPDATE ON public.membership_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_users_updated_at
    BEFORE UPDATE ON public.staff_users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if membership is active
CREATE OR REPLACE FUNCTION public.is_membership_active(membership_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.memberships 
        WHERE id = membership_id 
        AND status = 'active' 
        AND start_date <= CURRENT_DATE 
        AND end_date >= CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get member's active membership
CREATE OR REPLACE FUNCTION public.get_active_membership(member_uuid UUID)
RETURNS UUID AS $$
DECLARE
    membership_uuid UUID;
BEGIN
    SELECT id INTO membership_uuid
    FROM public.memberships 
    WHERE member_id = member_uuid 
    AND status = 'active' 
    AND start_date <= CURRENT_DATE 
    AND end_date >= CURRENT_DATE
    ORDER BY end_date DESC
    LIMIT 1;
    
    RETURN membership_uuid;
END;
$$ LANGUAGE plpgsql;