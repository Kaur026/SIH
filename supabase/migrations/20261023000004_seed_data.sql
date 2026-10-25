-- ============================================================================
-- Migration: 20261023000004_seed_data.sql
-- Description: Standard seed data for AICTE bureaus/cells, technical institutions,
-- sample complaints, assignments, updates, and audit trails.
-- Note: All UUIDs strictly follow RFC 4122 hexadecimal notation [0-9a-f].
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED DEPARTMENTS (AICTE Bureaus and Cells)
-- ----------------------------------------------------------------------------
INSERT INTO public.departments (id, name, code, description)
VALUES 
    (
        'd0000000-0000-0000-0000-000000000001',
        'Regulation Bureau',
        'RB',
        'Responsible for institutional norm enforcement, AICTE Approval Process Handbook (APH) compliance, fee regulatory oversight, and legal directives.'
    ),
    (
        'd0000000-0000-0000-0000-000000000002',
        'Public Grievance Redressal Cell',
        'PGRC',
        'Handles grievances from students, parents, faculty, and stakeholders regarding technical and management institutions.'
    ),
    (
        'd0000000-0000-0000-0000-000000000003',
        'Approval Bureau',
        'AB',
        'Processes Extension of Approvals (EoA), course additions, intake variations, and punitive actions on approval status.'
    ),
    (
        'd0000000-0000-0000-0000-000000000004',
        'Policy & Academic Planning Bureau',
        'P&AP',
        'Oversees model curricula, credit framework compliance, degree authenticity disputes, and academic integrity norms.'
    )
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ----------------------------------------------------------------------------
-- 2. SEED TECHNICAL INSTITUTIONS (Verified AICTE Permanent IDs)
-- Prefix 'a000...' (valid hexadecimal)
-- ----------------------------------------------------------------------------
INSERT INTO public.institutions (id, institution_name, aicte_permanent_id, address, state, district, institution_type)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        'Delhi Engineering & Technology Institute',
        '1-3329182301',
        'Sector 14, Dwarka Institutional Area',
        'Delhi',
        'South West Delhi',
        'Engineering & Technology'
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        'Bhartiya Advanced Institute of Management',
        '1-4920194812',
        'Electronic City Phase 1, Hosur Road',
        'Karnataka',
        'Bengaluru Urban',
        'Management'
    ),
    (
        'a0000000-0000-0000-0000-000000000003',
        'Maharashtra Polytech & Research Academy',
        '1-5829104921',
        'Shivajinagar, Ganeshkhind Road',
        'Maharashtra',
        'Pune',
        'Polytechnic'
    ),
    (
        'a0000000-0000-0000-0000-000000000004',
        'Apex Institute of Pharmaceutical Sciences',
        '1-7102948210',
        'Kursi Road, Jankipuram',
        'Uttar Pradesh',
        'Lucknow',
        'Pharmacy'
    ),
    (
        'a0000000-0000-0000-0000-000000000005',
        'Vidyapeeth Institute of Science & Technology',
        '1-8930219482',
        'Old Mahabalipuram Road, Navalur',
        'Tamil Nadu',
        'Chennai',
        'Engineering & Technology'
    ),
    (
        'a0000000-0000-0000-0000-000000000006',
        'Aryavart Institute of Technical Education',
        '1-6291048201',
        'Sitapura Industrial Area, Tonk Road',
        'Rajasthan',
        'Jaipur',
        'Engineering & Technology'
    )
ON CONFLICT (aicte_permanent_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. PROVISION DEMO AUTH USERS IN auth.users & public.profiles
-- User UUIDs: Prefix 'b000...' (valid hexadecimal)
-- Password for all seed demo accounts: Aicte@Admin2026
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    admin_id UUID := 'b0000000-0000-0000-0000-000000000001';
    rb_officer_id UUID := 'b0000000-0000-0000-0000-000000000002';
    pgrc_officer_id UUID := 'b0000000-0000-0000-0000-000000000003';
    reviewer_id UUID := 'b0000000-0000-0000-0000-000000000004';

    rb_dept_id UUID := 'd0000000-0000-0000-0000-000000000001';
    pgrc_dept_id UUID := 'd0000000-0000-0000-0000-000000000002';
    ab_dept_id UUID := 'd0000000-0000-0000-0000-000000000003';
    
    comp1_id UUID := 'c0000000-0000-0000-0000-000000000001';
    comp2_id UUID := 'c0000000-0000-0000-0000-000000000002';
    comp3_id UUID := 'c0000000-0000-0000-0000-000000000003';
    comp4_id UUID := 'c0000000-0000-0000-0000-000000000004';
    comp5_id UUID := 'c0000000-0000-0000-0000-000000000005';
BEGIN
    -- Check if auth.users table is accessible and populate demo accounts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        
        -- Admin User: admin@aicte.gov.in
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'admin@aicte.gov.in',
            crypt('Aicte@Admin2026', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Dr. R. K. Sharma", "role": "Administrator", "department_code": "RB", "designation": "Chief Vigilance Officer"}'::jsonb,
            now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- RB Officer: rb.officer@aicte.gov.in
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            rb_officer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'rb.officer@aicte.gov.in',
            crypt('Aicte@Admin2026', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Smt. Sunita Verma", "role": "Bureau Officer", "department_code": "RB", "designation": "Director (Regulation)"}'::jsonb,
            now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- PGRC Officer: pgrc.officer@aicte.gov.in
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            pgrc_officer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'pgrc.officer@aicte.gov.in',
            crypt('Aicte@Admin2026', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Shri Arvind Nair", "role": "Bureau Officer", "department_code": "PGRC", "designation": "Nodal Officer (PGRC)"}'::jsonb,
            now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- Cross-Department Reviewer: reviewer@aicte.gov.in
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            reviewer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'reviewer@aicte.gov.in',
            crypt('Aicte@Admin2026', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Dr. Meenakshi Sundaram", "role": "Cross-Department Reviewer", "department_code": "AB", "designation": "Senior Consultant (Coordination)"}'::jsonb,
            now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- Link auth.identities so Supabase GoTrue authentication does not fail with schema error
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        )
        SELECT u.id, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', u.email, now(), now(), now()
        FROM auth.users u
        WHERE u.id IN (admin_id, rb_officer_id, pgrc_officer_id, reviewer_id)
        ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;

    -- Upsert Public Profiles
    INSERT INTO public.profiles (id, full_name, department_id, role, designation, contact_number)
    VALUES
        (admin_id, 'Dr. R. K. Sharma', rb_dept_id, 'Administrator', 'Chief Vigilance Officer', '+91 11 2958 1000'),
        (rb_officer_id, 'Smt. Sunita Verma', rb_dept_id, 'Bureau Officer', 'Director (Regulation)', '+91 11 2958 1012'),
        (pgrc_officer_id, 'Shri Arvind Nair', pgrc_dept_id, 'Bureau Officer', 'Nodal Officer (PGRC)', '+91 11 2958 1024'),
        (reviewer_id, 'Dr. Meenakshi Sundaram', ab_dept_id, 'Cross-Department Reviewer', 'Senior Consultant (Coordination)', '+91 11 2958 1036')
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department_id = EXCLUDED.department_id,
        designation = EXCLUDED.designation;

    -- ------------------------------------------------------------------------
    -- 4. SEED SAMPLE COMPLAINTS
    -- ------------------------------------------------------------------------
    -- Complaint 1: Regulation Bureau - Capitation fee violation
    INSERT INTO public.complaints (
        id, complaint_number, institution_id, title, description,
        category, priority, status, assigned_department_id, assigned_officer_id,
        received_at, due_at, created_by
    ) VALUES (
        comp1_id,
        'AICTE-2026-01001',
        'a0000000-0000-0000-0000-000000000001',
        'Excess capitation fee collection under institutional quota',
        'Parent complaints regarding arbitrary capitation fee demand of INR 3,50,000 in cash prior to granting admission confirmation in B.Tech Computer Science, violating AICTE Approval Process Handbook Clause 13.2.',
        'Fee Cap Violation',
        'Urgent',
        'In Progress',
        rb_dept_id,
        rb_officer_id,
        now() - INTERVAL '12 days',
        now() + INTERVAL '3 days',
        admin_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Complaint 2: PGRC - Withholding original educational certificates
    INSERT INTO public.complaints (
        id, complaint_number, institution_id, title, description,
        category, priority, status, assigned_department_id, assigned_officer_id,
        received_at, due_at, created_by
    ) VALUES (
        comp2_id,
        'AICTE-2026-01002',
        'a0000000-0000-0000-0000-000000000002',
        'Withholding of original degree certificates on course withdrawal',
        'Grievance filed by final semester MBA students. The college administration has retained 10th, 12th, and undergraduate mark sheets, refusing return despite full payment of prescribed fee schedule.',
        'Non-Refund of Security Deposit',
        'High',
        'Under Review',
        pgrc_dept_id,
        pgrc_officer_id,
        now() - INTERVAL '8 days',
        now() + INTERVAL '7 days',
        pgrc_officer_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Complaint 3: Regulation Bureau - Running unapproved postgraduate diploma
    INSERT INTO public.complaints (
        id, complaint_number, institution_id, title, description,
        category, priority, status, assigned_department_id, assigned_officer_id,
        received_at, due_at, created_by
    ) VALUES (
        comp3_id,
        'AICTE-2026-01003',
        'a0000000-0000-0000-0000-000000000003',
        'Operation of unapproved Post Graduate Diploma in AI & Robotics',
        'Institute is advertising and enrolling students in 2-year PGDM without seeking mandatory Extension of Approval (EoA) from AICTE for the academic year 2026-27.',
        'Unauthorized Course Operation',
        'High',
        'Received',
        rb_dept_id,
        rb_officer_id,
        now() - INTERVAL '3 days',
        now() + INTERVAL '12 days',
        admin_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Complaint 4: PGRC - Faculty salary delay and 7th CPC non-implementation
    INSERT INTO public.complaints (
        id, complaint_number, institution_id, title, description,
        category, priority, status, assigned_department_id, assigned_officer_id,
        received_at, due_at, resolved_at, created_by
    ) VALUES (
        comp4_id,
        'AICTE-2026-01004',
        'a0000000-0000-0000-0000-000000000004',
        'Non-disbursement of faculty remuneration for 4 consecutive months',
        'Faculty collective grievance concerning pending salaries from May to August 2026. College management had withheld bank transfer proofs requested during previous review committee.',
        'Faculty Deficiency',
        'Normal',
        'Resolved',
        pgrc_dept_id,
        pgrc_officer_id,
        now() - INTERVAL '30 days',
        now() - INTERVAL '2 days',
        now() - INTERVAL '1 day',
        pgrc_officer_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Complaint 5: Regulation Bureau - Ghost faculty and artificial student-teacher ratio
    INSERT INTO public.complaints (
        id, complaint_number, institution_id, title, description,
        category, priority, status, assigned_department_id, assigned_officer_id,
        received_at, due_at, created_by
    ) VALUES (
        comp5_id,
        'AICTE-2026-01005',
        'a0000000-0000-0000-0000-000000000005',
        'Fictitious faculty entries during surprise inspection',
        'Discrepancy identified between faculty attendance biometric logs and portal declarations. 14 faculty members listed in mechanical and electrical streams were not found on campus during surprise physical verification.',
        'Faculty Deficiency',
        'Urgent',
        'In Progress',
        rb_dept_id,
        rb_officer_id,
        now() - INTERVAL '18 days',
        now() - INTERVAL '1 day', -- Overdue complaint
        admin_id
    ) ON CONFLICT (id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- 5. SEED INVESTIGATION UPDATES
    -- Update IDs prefix 'e000...' (valid hexadecimal)
    -- ------------------------------------------------------------------------
    INSERT INTO public.complaint_updates (id, complaint_id, author_id, update_text, created_at)
    VALUES
        (
            'e0000000-0000-0000-0000-000000000001',
            comp1_id,
            rb_officer_id,
            'Issued formal show-cause notice AICTE/RB/SCN/2026/892 to Chairman and Principal. Requested audited fee ledger within 7 business days.',
            now() - INTERVAL '10 days'
        ),
        (
            'e0000000-0000-0000-0000-000000000002',
            comp1_id,
            rb_officer_id,
            'Institute submitted initial response denying cash transactions. Complainants provided stamped bank withdrawal slips and handwritten counter receipts. Evidence forwarded to Vigilance Officer for verification.',
            now() - INTERVAL '4 days'
        ),
        (
            'e0000000-0000-0000-0000-000000000003',
            comp4_id,
            pgrc_officer_id,
            'Joint tripartite hearing conducted via National Knowledge Network video conference. Management committed to releasing pending dues via RTGS in two tranches.',
            now() - INTERVAL '15 days'
        ),
        (
            'e0000000-0000-0000-0000-000000000004',
            comp4_id,
            pgrc_officer_id,
            'Bank credit vouchers verified for all 28 faculty members. Complainants confirmed receipt of full settlement. Complaint marked as Resolved.',
            now() - INTERVAL '1 day'
        )
    ON CONFLICT (id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- 6. SEED NOTIFICATIONS
    -- Notification IDs prefix 'f000...' (valid hexadecimal)
    -- ------------------------------------------------------------------------
    INSERT INTO public.notifications (id, recipient_id, complaint_id, notification_type, message, is_read, created_at)
    VALUES
        (
            'f0000000-0000-0000-0000-000000000001',
            rb_officer_id,
            comp1_id,
            'assignment',
            'Urgent complaint AICTE-2026-01001 assigned to you: "Excess capitation fee collection under institutional quota".',
            false,
            now() - INTERVAL '12 days'
        ),
        (
            'f0000000-0000-0000-0000-000000000002',
            rb_officer_id,
            comp5_id,
            'status_change',
            'ATTENTION: Complaint AICTE-2026-01005 is now OVERDUE. Immediate hearing schedule required.',
            false,
            now() - INTERVAL '1 day'
        ),
        (
            'f0000000-0000-0000-0000-000000000003',
            pgrc_officer_id,
            comp2_id,
            'assignment',
            'New grievance AICTE-2026-01002 registered regarding certificate retention.',
            true,
            now() - INTERVAL '8 days'
        )
    ON CONFLICT (id) DO NOTHING;

END $$;
