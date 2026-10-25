-- ============================================================================
-- Migration: 20261023000001_initial_schema.sql
-- Description: AICTE Cross-Bureau Complaint Coordination Platform
-- SIH Problem Statement ID: 26264
-- Core Tables: departments, profiles, institutions, complaints,
--              complaint_updates, complaint_assignments, notifications, audit_logs
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS TABLE (Bureaus and Cells)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments IS 'AICTE participating bureaus and cells (e.g. RB, PGRC, AB).';

-- ----------------------------------------------------------------------------
-- 2. USER PROFILES TABLE (Associated with Supabase Auth)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('Administrator', 'Bureau Officer', 'Cross-Department Reviewer')) DEFAULT 'Bureau Officer',
    designation TEXT,
    contact_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Application user profile and bureau role linkage.';

-- ----------------------------------------------------------------------------
-- 3. INSTITUTIONS TABLE (AICTE Affiliated / Technical Institutions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_name TEXT NOT NULL,
    aicte_permanent_id TEXT UNIQUE,
    address TEXT,
    state TEXT NOT NULL,
    district TEXT,
    institution_type TEXT DEFAULT 'Technical Institute',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.institutions IS 'Institutions governed by or referenced in AICTE complaints.';

-- ----------------------------------------------------------------------------
-- 4. SAFE COMPLAINT NUMBER SEQUENCE & GENERATOR
-- Concurrency-safe, race-condition immune mechanism
-- Format: AICTE-YYYY-XXXXX (e.g. AICTE-2026-01001)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.complaint_number_seq START WITH 1001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_complaint_number()
RETURNS TEXT AS $$
DECLARE
    current_yr TEXT;
    seq_val BIGINT;
BEGIN
    current_yr := to_char(CURRENT_DATE, 'YYYY');
    seq_val := nextval('public.complaint_number_seq');
    RETURN 'AICTE-' || current_yr || '-' || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ----------------------------------------------------------------------------
-- 5. COMPLAINTS TABLE (Central complaint records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_number TEXT NOT NULL UNIQUE DEFAULT public.generate_complaint_number(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Normal', 'High', 'Urgent')) DEFAULT 'Normal',
    status TEXT NOT NULL CHECK (status IN ('Received', 'Under Review', 'In Progress', 'On Hold', 'Resolved', 'Closed')) DEFAULT 'Received',
    assigned_department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    assigned_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.complaints IS 'Central complaints registered across AICTE bureaus and cells.';

-- ----------------------------------------------------------------------------
-- 6. COMPLAINT UPDATES TABLE (Investigation notes & progress entries)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    update_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.complaint_updates IS 'Official investigation notes and progress entries for complaints.';

-- ----------------------------------------------------------------------------
-- 7. COMPLAINT ASSIGNMENTS TABLE (Assignment & transfer history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);

COMMENT ON TABLE public.complaint_assignments IS 'Complete auditable history of complaint bureau/officer assignments.';

-- ----------------------------------------------------------------------------
-- 8. NOTIFICATIONS TABLE (In-app notifications)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('assignment', 'status_change', 'update', 'administrative')),
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS 'In-app real-time alerts for bureau officers and administrators.';

-- ----------------------------------------------------------------------------
-- 9. AUDIT LOGS TABLE (Tamper-evident system activity log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'STATUS_CHANGE', 'ASSIGNMENT_CHANGE', 'UPDATE_ADDED', 'ADMIN_ACTION')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('complaint', 'assignment', 'profile', 'department', 'institution')),
    entity_id UUID NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Immutable chronological audit record of actions taken in the platform.';

-- ----------------------------------------------------------------------------
-- 10. INDEXES FOR PERFORMANCE & SEARCH
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_departments_code ON public.departments(code);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_institutions_aicte_id ON public.institutions(aicte_permanent_id);
CREATE INDEX IF NOT EXISTS idx_institutions_state ON public.institutions(state);

CREATE INDEX IF NOT EXISTS idx_complaints_complaint_number ON public.complaints(complaint_number);
CREATE INDEX IF NOT EXISTS idx_complaints_institution ON public.complaints(institution_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_dept ON public.complaints(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_officer ON public.complaints(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_due_at ON public.complaints(due_at);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_updates_complaint ON public.complaint_updates(complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint ON public.complaint_assignments(complaint_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
