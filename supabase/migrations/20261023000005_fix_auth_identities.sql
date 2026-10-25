-- ============================================================================
-- Migration: 20261023000005_fix_auth_identities.sql
-- Description: Links auth.identities for seed users so Supabase GoTrue can
-- authenticate them without "Database error querying schema".
-- ============================================================================

DO $$
BEGIN
    -- Check if auth.identities exists and populate identities for the seed accounts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        )
        SELECT 
            u.id,
            u.id,
            jsonb_build_object('sub', u.id::text, 'email', u.email),
            'email',
            u.email,
            now(),
            now(),
            now()
        FROM auth.users u
        WHERE u.email IN (
            'admin@aicte.gov.in',
            'rb.officer@aicte.gov.in',
            'pgrc.officer@aicte.gov.in',
            'reviewer@aicte.gov.in'
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;
END $$;
