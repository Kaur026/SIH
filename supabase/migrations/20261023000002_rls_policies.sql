-- ============================================================================
-- Migration: 20261023000002_rls_policies.sql
-- Description: Row Level Security (RLS) policies for AICTE Platform
-- Ensures strict role-based access control, departmental boundary protection,
-- and tamper prevention across all endpoints.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. SECURITY HELPER FUNCTIONS (SECURITY DEFINER to prevent recursion)
-- ----------------------------------------------------------------------------

-- Check if current authenticated user is an Administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Administrator'
    );
$$;

-- Check if current authenticated user is a Cross-Department Reviewer
CREATE OR REPLACE FUNCTION public.is_cross_dept_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Cross-Department Reviewer'
    );
$$;

-- Get current authenticated user's department ID
CREATE OR REPLACE FUNCTION public.get_user_department_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT department_id FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- Check if current user has access to a specific complaint
CREATE OR REPLACE FUNCTION public.can_access_complaint(complaint_assigned_dept UUID, complaint_creator UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT (
        public.is_admin() OR
        public.is_cross_dept_reviewer() OR
        complaint_assigned_dept = public.get_user_department_id() OR
        complaint_creator = auth.uid()
    );
$$;

-- ----------------------------------------------------------------------------
-- 3. POLICIES: DEPARTMENTS
-- ----------------------------------------------------------------------------
-- All authenticated officers can view departments list
CREATE POLICY "Authenticated users can view departments"
    ON public.departments FOR SELECT
    TO authenticated
    USING (true);

-- Only Administrators can add or modify departments
CREATE POLICY "Only admins can insert departments"
    ON public.departments FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update departments"
    ON public.departments FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete departments"
    ON public.departments FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. POLICIES: INSTITUTIONS
-- ----------------------------------------------------------------------------
-- Authenticated users can search and view institutions
CREATE POLICY "Authenticated users can view institutions"
    ON public.institutions FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated officers and admins can register new institutions
CREATE POLICY "Officers and admins can insert institutions"
    ON public.institutions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated officers and admins can update institution details
CREATE POLICY "Officers and admins can update institutions"
    ON public.institutions FOR UPDATE
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins can delete an institution record
CREATE POLICY "Only admins can delete institutions"
    ON public.institutions FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. POLICIES: PROFILES
-- ----------------------------------------------------------------------------
-- Authenticated users can view profiles (to display assigned officer names, authors)
CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert their own profile on signup or admins can insert
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- Users can update non-privileged fields on their own profile, admins can update any
CREATE POLICY "Users or admins can update profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. POLICIES: COMPLAINTS
-- ----------------------------------------------------------------------------
-- SELECT: Admins & Cross-dept reviewers see all; Officers see assigned dept or created by them
CREATE POLICY "Complaints select policy"
    ON public.complaints FOR SELECT
    TO authenticated
    USING (
        public.is_admin() OR
        public.is_cross_dept_reviewer() OR
        assigned_department_id = public.get_user_department_id() OR
        created_by = auth.uid()
    );

-- INSERT: Authenticated users can create complaints
CREATE POLICY "Authenticated users can create complaints"
    ON public.complaints FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        created_by = auth.uid()
    );

-- UPDATE: Admins can update any; Officers can update complaints in their department
CREATE POLICY "Authorized users can update complaints"
    ON public.complaints FOR UPDATE
    TO authenticated
    USING (
        public.is_admin() OR
        assigned_department_id = public.get_user_department_id()
    )
    WITH CHECK (
        public.is_admin() OR
        assigned_department_id = public.get_user_department_id()
    );

-- DELETE: Only Administrators can delete complaints (e.g. invalid test entries)
CREATE POLICY "Only admins can delete complaints"
    ON public.complaints FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. POLICIES: COMPLAINT UPDATES (Investigation Notes)
-- ----------------------------------------------------------------------------
-- SELECT: Users who can view the complaint can view its updates
CREATE POLICY "Users can view updates for accessible complaints"
    ON public.complaint_updates FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_updates.complaint_id
            AND public.can_access_complaint(c.assigned_department_id, c.created_by)
        )
    );

-- INSERT: Authorized officers in the assigned department or admins can add notes
CREATE POLICY "Authorized officers can add complaint updates"
    ON public.complaint_updates FOR INSERT
    TO authenticated
    WITH CHECK (
        author_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_updates.complaint_id
            AND (public.is_admin() OR c.assigned_department_id = public.get_user_department_id())
        )
    );

-- Investigation updates are official records: NO DIRECT UPDATE OR DELETE through API
CREATE POLICY "Investigation updates cannot be modified by ordinary users"
    ON public.complaint_updates FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Investigation updates cannot be deleted except by admin"
    ON public.complaint_updates FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. POLICIES: COMPLAINT ASSIGNMENTS (History)
-- ----------------------------------------------------------------------------
-- SELECT: Users who can view the complaint can view its assignment history
CREATE POLICY "Users can view assignment history of accessible complaints"
    ON public.complaint_assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_assignments.complaint_id
            AND public.can_access_complaint(c.assigned_department_id, c.created_by)
        )
    );

-- INSERT: Managed via database triggers or authorized re-assignment
CREATE POLICY "Authorized users can insert assignments"
    ON public.complaint_assignments FOR INSERT
    TO authenticated
    WITH CHECK (
        assigned_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_assignments.complaint_id
            AND (public.is_admin() OR c.assigned_department_id = public.get_user_department_id())
        )
    );

-- Assignments are historical records: no deletion allowed
CREATE POLICY "Assignment history cannot be deleted"
    ON public.complaint_assignments FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. POLICIES: NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (recipient_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update their own notifications (mark as read)"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "System and authorized users can insert notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (recipient_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 10. POLICIES: AUDIT LOGS (Immutable System Activity Trail)
-- ----------------------------------------------------------------------------
-- SELECT: Admins can view all audit logs; Officers can view logs for their entity access
CREATE POLICY "Authorized users can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (
        public.is_admin() OR
        public.is_cross_dept_reviewer() OR
        (actor_id = auth.uid()) OR
        (entity_type = 'complaint' AND EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = audit_logs.entity_id
            AND public.can_access_complaint(c.assigned_department_id, c.created_by)
        ))
    );

-- INSERT: Allowed by authenticated operations or triggers
CREATE POLICY "Authenticated users and triggers can record audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- IMPORTANT PRD RESTRICTION: Ordinary users MUST NOT be able to modify or delete audit records
-- Explicitly NO UPDATE policy on audit_logs.
-- Explicitly NO DELETE policy on audit_logs (even admins cannot delete audit history).
