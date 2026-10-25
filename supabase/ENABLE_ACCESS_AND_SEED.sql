-- ============================================================================
-- AICTE PLATFORM: GRANT PERMISSIONS & POPULATE DATA
-- Run this in Supabase SQL Editor to make all data instantly visible
-- ============================================================================

-- 1. UPDATE ROW LEVEL SECURITY POLICIES TO ALLOW ANONYMOUS + AUTHENTICATED ACCESS
DROP POLICY IF EXISTS "Authenticated users can view departments" ON public.departments;
DROP POLICY IF EXISTS "Enable read access for all users on departments" ON public.departments;
CREATE POLICY "Enable read access for all users on departments"
    ON public.departments FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can view institutions" ON public.institutions;
DROP POLICY IF EXISTS "Enable read access for all users on institutions" ON public.institutions;
CREATE POLICY "Enable read access for all users on institutions"
    ON public.institutions FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Officers and admins can insert institutions" ON public.institutions;
DROP POLICY IF EXISTS "Enable insert for institutions" ON public.institutions;
CREATE POLICY "Enable insert for institutions"
    ON public.institutions FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Complaints select policy" ON public.complaints;
DROP POLICY IF EXISTS "Enable read access for complaints" ON public.complaints;
CREATE POLICY "Enable read access for complaints"
    ON public.complaints FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Enable insert for complaints" ON public.complaints;
CREATE POLICY "Enable insert for complaints"
    ON public.complaints FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authorized users can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Enable update for complaints" ON public.complaints;
CREATE POLICY "Enable update for complaints"
    ON public.complaints FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view updates for accessible complaints" ON public.complaint_updates;
DROP POLICY IF EXISTS "Enable read updates" ON public.complaint_updates;
CREATE POLICY "Enable read updates"
    ON public.complaint_updates FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Authorized officers can add complaint updates" ON public.complaint_updates;
DROP POLICY IF EXISTS "Enable insert updates" ON public.complaint_updates;
CREATE POLICY "Enable insert updates"
    ON public.complaint_updates FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view assignment history of accessible complaints" ON public.complaint_assignments;
DROP POLICY IF EXISTS "Enable read assignments" ON public.complaint_assignments;
CREATE POLICY "Enable read assignments"
    ON public.complaint_assignments FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Authorized users can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Enable read audit logs" ON public.audit_logs;
CREATE POLICY "Enable read audit logs"
    ON public.audit_logs FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read profiles" ON public.profiles;
CREATE POLICY "Enable read profiles"
    ON public.profiles FOR SELECT
    TO anon, authenticated
    USING (true);

-- 2. INSERT AICTE DEPARTMENTS
INSERT INTO public.departments (id, name, code, description)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 'Regulation Bureau', 'RB', 'Institutional norm enforcement and fee regulatory oversight.'),
    ('d0000000-0000-0000-0000-000000000002', 'Public Grievance Redressal Cell', 'PGRC', 'Student, parent, and faculty grievance redressal.'),
    ('d0000000-0000-0000-0000-000000000003', 'Approval Bureau', 'AB', 'Approval and accreditation oversight.'),
    ('d0000000-0000-0000-0000-000000000004', 'Policy & Academic Planning Bureau', 'P&AP', 'Model curricula and academic standards.')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 3. INSERT TECHNICAL INSTITUTIONS
INSERT INTO public.institutions (id, institution_name, aicte_permanent_id, address, state, institution_type)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Delhi Engineering & Technology Institute', '1-3329182301', 'Dwarka Institutional Area', 'Delhi', 'Engineering & Technology'),
    ('a0000000-0000-0000-0000-000000000002', 'Bhartiya Advanced Institute of Management', '1-4920194812', 'Electronic City Phase 1', 'Karnataka', 'Management'),
    ('a0000000-0000-0000-0000-000000000003', 'Maharashtra Polytech & Research Academy', '1-5829104921', 'Shivajinagar', 'Maharashtra', 'Polytechnic')
ON CONFLICT (aicte_permanent_id) DO NOTHING;

-- 4. INSERT SAMPLE COMPLAINTS (Temporarily disable foreign key to profiles if not populated)
DO $$
DECLARE
    creator_id UUID;
BEGIN
    SELECT id INTO creator_id FROM public.profiles LIMIT 1;
    IF creator_id IS NULL THEN
        -- Insert a system profile if none exists
        INSERT INTO public.profiles (id, full_name, role, department_id, designation)
        VALUES ('b0000000-0000-0000-0000-000000000001', 'Dr. R. K. Sharma', 'Administrator', 'd0000000-0000-0000-0000-000000000001', 'Chief Vigilance Officer')
        ON CONFLICT (id) DO NOTHING;
        creator_id := 'b0000000-0000-0000-0000-000000000001';
    END IF;

    INSERT INTO public.complaints (
        id, complaint_number, institution_id, title, description,
        category, priority, status, assigned_department_id,
        received_at, due_at, created_by
    ) VALUES 
        (
            'c0000000-0000-0000-0000-000000000001',
            'AICTE-2026-01001',
            'a0000000-0000-0000-0000-000000000001',
            'Excess capitation fee collection under institutional quota',
            'Parent complaints regarding arbitrary capitation fee demand of INR 3,50,000 in cash prior to granting admission confirmation in B.Tech Computer Science, violating AICTE Approval Process Handbook Clause 13.2.',
            'Fee Cap Violation',
            'Urgent',
            'In Progress',
            'd0000000-0000-0000-0000-000000000001',
            now() - INTERVAL '12 days',
            now() + INTERVAL '3 days',
            creator_id
        ),
        (
            'c0000000-0000-0000-0000-000000000002',
            'AICTE-2026-01002',
            'a0000000-0000-0000-0000-000000000002',
            'Withholding of original degree certificates on course withdrawal',
            'Grievance filed by final semester MBA students. The college administration has retained 10th, 12th, and undergraduate mark sheets, refusing return despite full payment of prescribed fee schedule.',
            'Non-Refund of Security Deposit',
            'High',
            'Under Review',
            'd0000000-0000-0000-0000-000000000002',
            now() - INTERVAL '8 days',
            now() + INTERVAL '7 days',
            creator_id
        ),
        (
            'c0000000-0000-0000-0000-000000000003',
            'AICTE-2026-01003',
            'a0000000-0000-0000-0000-000000000003',
            'Operation of unapproved Post Graduate Diploma in AI & Robotics',
            'Institute is advertising and enrolling students in 2-year PGDM without seeking mandatory Extension of Approval (EoA) from AICTE for the academic year 2026-27.',
            'Unauthorized Course Operation',
            'High',
            'Received',
            'd0000000-0000-0000-0000-000000000001',
            now() - INTERVAL '3 days',
            now() + INTERVAL '12 days',
            creator_id
        )
    ON CONFLICT (id) DO NOTHING;
END $$;
