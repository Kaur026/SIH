-- ============================================================================
-- QUICK DATABASE SEED & FIX SCRIPT
-- AICTE Cross-Bureau Complaint Coordination Platform (SIH-26264)
-- ============================================================================

-- 1. CLEAN UP PREVIOUS CORRUPT MANUAL AUTH ROWS
DELETE FROM auth.users WHERE email IN (
    'admin@aicte.gov.in',
    'rb.officer@aicte.gov.in',
    'pgrc.officer@aicte.gov.in',
    'reviewer@aicte.gov.in'
);

-- 2. INSERT AICTE DEPARTMENTS (RB, PGRC, AB, P&AP)
INSERT INTO public.departments (id, name, code, description)
VALUES 
    (
        'd0000000-0000-0000-0000-000000000001',
        'Regulation Bureau',
        'RB',
        'Responsible for institutional norm enforcement, Approval Process Handbook (APH) compliance, fee regulatory oversight, and legal directives.'
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
        'Processes Extension of Approvals (EoA), course additions, intake variations, and punitive actions.'
    ),
    (
        'd0000000-0000-0000-0000-000000000004',
        'Policy & Academic Planning Bureau',
        'P&AP',
        'Oversees model curricula, credit framework compliance, and academic integrity norms.'
    )
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 3. INSERT TECHNICAL INSTITUTIONS
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

-- 4. INSERT SAMPLE COMPLAINTS
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
        '00000000-0000-0000-0000-000000000000'
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
        '00000000-0000-0000-0000-000000000000'
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
        '00000000-0000-0000-0000-000000000000'
    ),
    (
        'c0000000-0000-0000-0000-000000000004',
        'AICTE-2026-01004',
        'a0000000-0000-0000-0000-000000000004',
        'Non-disbursement of faculty remuneration for 4 consecutive months',
        'Faculty collective grievance concerning pending salaries from May to August 2026. Management has delayed disbursement despite repeated representations.',
        'Faculty Deficiency',
        'Normal',
        'Resolved',
        'd0000000-0000-0000-0000-000000000002',
        now() - INTERVAL '30 days',
        now() - INTERVAL '2 days',
        '00000000-0000-0000-0000-000000000000'
    )
ON CONFLICT (id) DO NOTHING;

-- 5. AUTO-CONFIRM ANY PENDING AUTH USERS SO THEY CAN LOG IN WITHOUT VERIFICATION EMAILS
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;
