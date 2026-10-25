-- ============================================================================
-- Migration: 20261024000001_public_grievance_portal.sql
-- Description: Enables public grievance registration for students and institutions.
-- Fixes sequence 1050 to prevent 23505 duplicate key error.
-- Adds complainant contact fields and makes created_by nullable.
-- ============================================================================

-- 1. Advance sequence past all seeded numbers so new complaints never collide
SELECT setval('public.complaint_number_seq', 1050);

-- 2. Allow public grievance submissions (students/institutions don't have internal profile IDs)
ALTER TABLE public.complaints ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.complaint_assignments ALTER COLUMN assigned_by DROP NOT NULL;

-- 3. Add public complainant metadata fields to complaints table
ALTER TABLE public.complaints 
    ADD COLUMN IF NOT EXISTS complainant_name TEXT,
    ADD COLUMN IF NOT EXISTS complainant_email TEXT,
    ADD COLUMN IF NOT EXISTS complainant_phone TEXT,
    ADD COLUMN IF NOT EXISTS complainant_type TEXT DEFAULT 'Student',
    ADD COLUMN IF NOT EXISTS student_roll_no TEXT;

-- 4. Update complaint creation trigger to support public submissions
CREATE OR REPLACE FUNCTION public.handle_complaint_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Create the initial assignment record
    INSERT INTO public.complaint_assignments (
        complaint_id,
        department_id,
        officer_id,
        assigned_by,
        assigned_at
    ) VALUES (
        NEW.id,
        NEW.assigned_department_id,
        NEW.assigned_officer_id,
        NEW.created_by,
        now()
    );

    -- 2. Record creation event in audit_logs
    INSERT INTO public.audit_logs (
        actor_id,
        action_type,
        entity_type,
        entity_id,
        details
    ) VALUES (
        NEW.created_by,
        'CREATE',
        'complaint',
        NEW.id,
        jsonb_build_object(
            'complaint_number', NEW.complaint_number,
            'title', NEW.title,
            'priority', NEW.priority,
            'status', NEW.status,
            'complainant_name', NEW.complainant_name,
            'complainant_type', NEW.complainant_type,
            'assigned_department_id', NEW.assigned_department_id
        )
    );

    -- 3. Notify assigned officer if specified
    IF NEW.assigned_officer_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            recipient_id,
            complaint_id,
            notification_type,
            message
        ) VALUES (
            NEW.assigned_officer_id,
            NEW.id,
            'assignment',
            'New public grievance ' || NEW.complaint_number || ' received: "' || substring(NEW.title from 1 for 40) || '..."'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- 5. Row Level Security: Allow public intake & tracking
DROP POLICY IF EXISTS "Authenticated users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Enable insert for complaints" ON public.complaints;
DROP POLICY IF EXISTS "Enable public insert for complaints" ON public.complaints;
CREATE POLICY "Enable public insert for complaints"
    ON public.complaints FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for complaints" ON public.complaints;
CREATE POLICY "Enable read access for complaints"
    ON public.complaints FOR SELECT
    TO anon, authenticated
    USING (true);
