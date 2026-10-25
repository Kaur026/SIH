import { supabase } from './client';
import type { ComplaintStatus, AuditLogWithActor, DepartmentRow } from '../../types/database.types';

export interface DashboardMetrics {
  totalComplaints: number;
  receivedCount: number;
  underReviewCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  overdueCount: number;
  departmentWorkload: {
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    total: number;
    pending: number;
    resolved: number;
  }[];
  recentActivity: AuditLogWithActor[];
}

export async function getDashboardMetrics(departmentId?: string): Promise<DashboardMetrics> {
  // 1. Fetch complaints summary
  let complaintsQuery = supabase
    .from('complaints')
    .select('id, status, due_at, assigned_department_id, resolved_at, created_at');

  if (departmentId && departmentId !== 'ALL') {
    complaintsQuery = complaintsQuery.eq('assigned_department_id', departmentId);
  }

  const { data: rawComplaints, error: complaintsError } = await complaintsQuery;

  if (complaintsError) {
    console.error('Error fetching complaints for metrics:', complaintsError.message);
    throw complaintsError;
  }

  // 2. Fetch departments
  const { data: rawDepartments, error: deptsError } = await supabase
    .from('departments')
    .select('id, name, code');

  if (deptsError) {
    console.error('Error fetching departments for metrics:', deptsError.message);
    throw deptsError;
  }

  // 3. Fetch recent audit activity
  const { data: rawActivity, error: auditError } = await supabase
    .from('audit_logs')
    .select(`
      *,
      actor:profiles(*)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (auditError) {
    console.error('Error fetching recent audit logs:', auditError.message);
  }

  const now = new Date();

  let receivedCount = 0;
  let underReviewCount = 0;
  let inProgressCount = 0;
  let resolvedCount = 0;
  let closedCount = 0;
  let overdueCount = 0;

  type DeptSummary = { id: string; name: string; code: string };
  type ComplaintSummary = {
    id: string;
    status: ComplaintStatus;
    due_at: string | null;
    assigned_department_id: string;
    resolved_at: string | null;
    created_at: string;
  };

  const departments = (rawDepartments as unknown as DeptSummary[]) || [];
  const complaints = (rawComplaints as unknown as ComplaintSummary[]) || [];

  const deptMap: Record<string, { total: number; pending: number; resolved: number }> = {};
  departments.forEach((d: DeptSummary) => {
    deptMap[d.id] = { total: 0, pending: 0, resolved: 0 };
  });

  complaints.forEach((c: ComplaintSummary) => {
    const status = c.status;

    if (status === 'Received') receivedCount++;
    else if (status === 'Under Review') underReviewCount++;
    else if (status === 'In Progress') inProgressCount++;
    else if (status === 'Resolved') resolvedCount++;
    else if (status === 'Closed') closedCount++;

    const isPending = !['Resolved', 'Closed'].includes(status);
    if (isPending && c.due_at && new Date(c.due_at) < now) {
      overdueCount++;
    }

    if (c.assigned_department_id && deptMap[c.assigned_department_id]) {
      deptMap[c.assigned_department_id].total++;
      if (isPending) deptMap[c.assigned_department_id].pending++;
      if (status === 'Resolved' || status === 'Closed') deptMap[c.assigned_department_id].resolved++;
    }
  });

  const departmentWorkload = departments
    .filter((dept: DepartmentRow | DeptSummary) => 
      !departmentId || departmentId === 'ALL' || dept.id === departmentId
    )
    .map((dept: DepartmentRow | DeptSummary) => ({
      departmentId: dept.id,
      departmentName: dept.name,
      departmentCode: dept.code,
      total: deptMap[dept.id]?.total || 0,
      pending: deptMap[dept.id]?.pending || 0,
      resolved: deptMap[dept.id]?.resolved || 0,
    }));

  return {
    totalComplaints: complaints.length,
    receivedCount,
    underReviewCount,
    inProgressCount,
    resolvedCount,
    closedCount,
    overdueCount,
    departmentWorkload,
    recentActivity: (rawActivity as unknown as AuditLogWithActor[]) || [],
  };
}
