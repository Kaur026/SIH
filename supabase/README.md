# Supabase Backend Configuration Guide
## AICTE Cross-Bureau Complaint Coordination Platform (SIH-26264)

This project uses **Supabase PostgreSQL** as its primary authoritative backend, with Row Level Security (RLS), automated audit logging, sequential complaint numbering, and assignment tracking.

---

## 1. Migration Files Breakdown

All migrations are located in `supabase/migrations/`:

| File | Purpose |
|---|---|
| `20261023000001_initial_schema.sql` | Tables (`departments`, `profiles`, `institutions`, `complaints`, `complaint_updates`, `complaint_assignments`, `notifications`, `audit_logs`), sequences, constraints, and indexes. |
| `20261023000002_rls_policies.sql` | Row Level Security policies, security definer helpers (`is_admin`, `is_cross_dept_reviewer`, `get_user_department_id`). |
| `20261023000003_triggers_and_functions.sql` | Automated audit logging, complaint number generator, assignment history tracking, anti-privilege-escalation guards, and audit immutability triggers. |
| `20261023000004_seed_data.sql` | Realistic seed data for AICTE bureaus (RB, PGRC, AB, P&AP), technical institutions, demo users, sample complaints, updates, and notifications. |

---

## 2. Option A: Applying Migrations via Supabase Web Dashboard (Easiest)

1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** in the left sidebar.
3. Open and run the migration files in numerical order:
   1. Copy and paste `20261023000001_initial_schema.sql` $\rightarrow$ Click **Run**.
   2. Copy and paste `20261023000002_rls_policies.sql` $\rightarrow$ Click **Run**.
   3. Copy and paste `20261023000003_triggers_and_functions.sql` $\rightarrow$ Click **Run**.
   4. Copy and paste `20261023000004_seed_data.sql` $\rightarrow$ Click **Run**.
4. In **Project Settings** $\rightarrow$ **API**, copy:
   - `Project URL`
   - `anon / public key`
5. Place them in your local `.env` file:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```

---

## 3. Option B: Applying Migrations via Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link to your remote project
supabase link --project-ref your-project-id

# Push all migrations
supabase db push
```

For local offline development with Docker:
```bash
# Start local containers
supabase start

# Reset and seed database
supabase db reset
```

---

## 4. Pre-configured Demo Accounts

The seed script initializes four authentic role-based accounts for testing (Password for all: `Aicte@Admin2026`):

| Role | Email | Name & Designation | Department |
|---|---|---|---|
| **Administrator** | `admin@aicte.gov.in` | Dr. R. K. Sharma (Chief Vigilance Officer) | Regulation Bureau |
| **Bureau Officer** | `rb.officer@aicte.gov.in` | Smt. Sunita Verma (Director, Regulation) | Regulation Bureau (RB) |
| **Bureau Officer** | `pgrc.officer@aicte.gov.in` | Shri Arvind Nair (Nodal Officer, PGRC) | Public Grievance Redressal Cell (PGRC) |
| **Cross-Dept Reviewer** | `reviewer@aicte.gov.in` | Dr. Meenakshi Sundaram (Senior Consultant) | Approval Bureau (AB) |

*(Note: In Supabase Auth, ensure Email confirmation is enabled or auto-confirmed. The seed script pre-confirms email timestamps for immediate login).*

---

## 5. Security & Access Control Summary

- **Self-Role Elevation Prevention**: The `trg_check_profile_privileges` trigger strictly blocks any authenticated user from changing their own `role` or `department_id`. Only an existing `Administrator` can alter roles.
- **Audit Immutability**: The `trg_audit_immutability` trigger ensures that no SQL statement (`UPDATE` or `DELETE`) can ever modify or erase records from `audit_logs`.
- **Departmental Isolation**: Regulation Bureau officers only have write and update permissions on complaints assigned to RB, while PGRC officers manage PGRC complaints. Cross-Department Reviewers and Administrators have cross-bureau visibility.
