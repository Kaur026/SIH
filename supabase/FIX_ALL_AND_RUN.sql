-- ============================================================================
-- AICTE RESET & SEED SCRIPT (Zero Foreign Key Conflicts)
-- ============================================================================

-- 1. Clear child records first to satisfy foreign key constraints
DELETE FROM public.complaint_updates;
DELETE FROM public.complaint_assignments;
DELETE FROM public.complaints;
DELETE FROM public.audit_logs;
DELETE FROM public.notifications;

-- 2. Clear old profiles and auth users
DELETE FROM public.profiles;
DELETE FROM auth.identities WHERE identity_data->>'email' LIKE '%@aicte.gov.in';
DELETE FROM auth.users WHERE email LIKE '%@aicte.gov.in';

-- 3. Populate AICTE Departments
INSERT INTO public.departments (id, name, code, description)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 'Regulation Bureau', 'RB', 'Institutional norm enforcement and fee compliance.'),
    ('d0000000-0000-0000-0000-000000000002', 'Public Grievance Redressal Cell', 'PGRC', 'Student, parent, and faculty grievance redressal.'),
    ('d0000000-0000-0000-0000-000000000003', 'Approval Bureau', 'AB', 'Approval and accreditation oversight.'),
    ('d0000000-0000-0000-0000-000000000004', 'Policy & Academic Planning Bureau', 'P&AP', 'Model curricula and academic standards.')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 4. Populate Technical Institutions
INSERT INTO public.institutions (id, institution_name, aicte_permanent_id, address, state, institution_type)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Delhi Engineering & Technology Institute', '1-3329182301', 'Dwarka Institutional Area', 'Delhi', 'Engineering & Technology'),
    ('a0000000-0000-0000-0000-000000000002', 'Bhartiya Advanced Institute of Management', '1-4920194812', 'Electronic City Phase 1', 'Karnataka', 'Management'),
    ('a0000000-0000-0000-0000-000000000003', 'Maharashtra Polytech & Research Academy', '1-5829104921', 'Shivajinagar', 'Maharashtra', 'Polytechnic')
ON CONFLICT (aicte_permanent_id) DO NOTHING;
