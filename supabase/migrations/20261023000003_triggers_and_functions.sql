-- ============================================================================
-- Migration: 20261023000003_triggers_and_functions.sql
-- Description: Automated business rules, audit logging, assignment management,
-- notification generation, and security guard triggers.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURITY: PREVENT SELF-ROLE ESCALATION OR UNAUTHORIZED ROLE/DEPT TAMPERING
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_profile_update_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If user is changing their own role or department, verify they are Administrator
    IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.department_id IS DISTINCT FROM NEW.department_id) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Access Denied: Only platform Administrators can change user roles or department assignments.';
        END IF;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_profile_privileges ON public.profiles;
CREATE TRIGGER trg_check_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_profile_update_privileges();

-- ----------------------------------------------------------------------------
-- 2. IMMUTABILITY: PROTECT AUDIT LOGS FROM ANY MODIFICATION OR DELETION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_audit_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Security Policy Violation: System audit logs are strictly immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutability ON public.audit_logs;
CREATE TRIGGER trg_audit_immutability
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_audit_log_immutability();

-- ----------------------------------------------------------------------------
-- 3. USER SIGNUP: AUTOMATIC PROFILE PROVISIONING VIA AUTH TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_dept_id UUID;
    user_name TEXT;
    user_role TEXT;
BEGIN
    -- Extract full name from metadata if provided, otherwise default to email prefix
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- Check if metadata explicitly provided a department code
    IF NEW.raw_user_meta_data->>'department_code' IS NOT NULL THEN
        SELECT id INTO default_dept_id FROM public.departments
        WHERE code = NEW.raw_user_meta_data->>'department_code' LIMIT 1;
    END IF;

    -- If no department found, default to Regulation Bureau (RB) or first available
    IF default_dept_id IS NULL THEN
        SELECT id INTO default_dept_id FROM public.departments
        WHERE code = 'RB' LIMIT 1;
    END IF;

    -- Only allow Administrator role if configured in specific bootstrapping or default to Bureau Officer
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Bureau Officer');
    IF user_role NOT IN ('Administrator', 'Bureau Officer', 'Cross-Department Reviewer') THEN
        user_role := 'Bureau Officer';
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        department_id,
        role,
        designation,
        contact_number
    ) VALUES (
        NEW.id,
        user_name,
        default_dept_id,
        user_role,
        COALESCE(NEW.raw_user_meta_data->>'designation', 'Desk Officer'),
        NEW.raw_user_meta_data->>'contact_number'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 4. COMPLAINT CREATION: INITIAL ASSIGNMENT & AUDIT LOGGING
-- ----------------------------------------------------------------------------
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
            'assigned_department_id', NEW.assigned_department_id,
            'assigned_officer_id', NEW.assigned_officer_id
        )
    );

    -- 3. Notify assigned officer if specified
    IF NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id <> NEW.created_by THEN
        INSERT INTO public.notifications (
            recipient_id,
            complaint_id,
            notification_type,
            message
        ) VALUES (
            NEW.assigned_officer_id,
            NEW.id,
            'assignment',
            'New complaint ' || NEW.complaint_number || ' assigned to you: "' || substring(NEW.title from 1 for 40) || '..."'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaint_creation ON public.complaints;
CREATE TRIGGER trg_complaint_creation
    AFTER INSERT ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_complaint_creation();

-- ----------------------------------------------------------------------------
-- 5. COMPLAINT UPDATE: STATUS CHANGES & RE-ASSIGNMENT HANDLING
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_complaint_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_actor UUID;
BEGIN
    current_actor := auth.uid();
    NEW.updated_at := now();

    -- Check for Status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- If status is set to Resolved, update resolved_at timestamp
        IF NEW.status = 'Resolved' AND OLD.status <> 'Resolved' THEN
            NEW.resolved_at := now();
        ELSIF NEW.status <> 'Resolved' THEN
            NEW.resolved_at := NULL;
        END IF;

        -- Record status change in audit logs
        INSERT INTO public.audit_logs (
            actor_id,
            action_type,
            entity_type,
            entity_id,
            details
        ) VALUES (
            current_actor,
            'STATUS_CHANGE',
            'complaint',
            NEW.id,
            jsonb_build_object(
                'complaint_number', NEW.complaint_number,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );

        -- Notify complaint creator if status changed
        IF NEW.created_by IS NOT NULL AND NEW.created_by <> current_actor THEN
            INSERT INTO public.notifications (
                recipient_id,
                complaint_id,
                notification_type,
                message
            ) VALUES (
                NEW.created_by,
                NEW.id,
                'status_change',
                'Complaint ' || NEW.complaint_number || ' status updated from ' || OLD.status || ' to ' || NEW.status || '.'
            );
        END IF;

        -- Notify assigned officer if status changed by another user
        IF NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id <> current_actor AND NEW.assigned_officer_id <> NEW.created_by THEN
            INSERT INTO public.notifications (
                recipient_id,
                complaint_id,
                notification_type,
                message
            ) VALUES (
                NEW.assigned_officer_id,
                NEW.id,
                'status_change',
                'Complaint ' || NEW.complaint_number || ' status updated to ' || NEW.status || '.'
            );
        END IF;
    END IF;

    -- Check for Assignment change (Department or Officer change)
    IF OLD.assigned_department_id IS DISTINCT FROM NEW.assigned_department_id OR
       OLD.assigned_officer_id IS DISTINCT FROM NEW.assigned_officer_id THEN

        -- Close active assignment record
        UPDATE public.complaint_assignments
        SET ended_at = now()
        WHERE complaint_id = NEW.id AND ended_at IS NULL;

        -- Insert new assignment record
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
            COALESCE(current_actor, NEW.created_by),
            now()
        );

        -- Record assignment change in audit logs
        INSERT INTO public.audit_logs (
            actor_id,
            action_type,
            entity_type,
            entity_id,
            details
        ) VALUES (
            current_actor,
            'ASSIGNMENT_CHANGE',
            'complaint',
            NEW.id,
            jsonb_build_object(
                'complaint_number', NEW.complaint_number,
                'old_department_id', OLD.assigned_department_id,
                'new_department_id', NEW.assigned_department_id,
                'old_officer_id', OLD.assigned_officer_id,
                'new_officer_id', NEW.assigned_officer_id
            )
        );

        -- Notify newly assigned officer
        IF NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id <> current_actor THEN
            INSERT INTO public.notifications (
                recipient_id,
                complaint_id,
                notification_type,
                message
            ) VALUES (
                NEW.assigned_officer_id,
                NEW.id,
                'assignment',
                'Complaint ' || NEW.complaint_number || ' has been assigned to you for investigation.'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaint_update ON public.complaints;
CREATE TRIGGER trg_complaint_update
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_complaint_update();

-- ----------------------------------------------------------------------------
-- 6. INVESTIGATION NOTES: AUDIT & TIMESTAMP REFRESH
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_complaint_update_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_complaint RECORD;
BEGIN
    -- Retrieve complaint info
    SELECT id, complaint_number, assigned_officer_id, created_by
    INTO target_complaint
    FROM public.complaints
    WHERE id = NEW.complaint_id;

    -- Update complaints.updated_at
    UPDATE public.complaints
    SET updated_at = now()
    WHERE id = NEW.complaint_id;

    -- Record in audit logs
    INSERT INTO public.audit_logs (
        actor_id,
        action_type,
        entity_type,
        entity_id,
        details
    ) VALUES (
        NEW.author_id,
        'UPDATE_ADDED',
        'complaint',
        NEW.complaint_id,
        jsonb_build_object(
            'complaint_number', target_complaint.complaint_number,
            'update_id', NEW.id,
            'preview', substring(NEW.update_text from 1 for 60)
        )
    );

    -- Notify assigned officer if note added by someone else
    IF target_complaint.assigned_officer_id IS NOT NULL AND target_complaint.assigned_officer_id <> NEW.author_id THEN
        INSERT INTO public.notifications (
            recipient_id,
            complaint_id,
            notification_type,
            message
        ) VALUES (
            target_complaint.assigned_officer_id,
            NEW.complaint_id,
            'update',
            'New investigation note added to complaint ' || target_complaint.complaint_number || '.'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaint_note_added ON public.complaint_updates;
CREATE TRIGGER trg_complaint_note_added
    AFTER INSERT ON public.complaint_updates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_complaint_update_entry();
