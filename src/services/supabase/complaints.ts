import { supabase } from './client';
import type {
  ComplaintPriority,
  ComplaintStatus,
  ComplaintWithRelations,
  ComplaintUpdateWithAuthor,
  AssignmentWithRelations,
  AuditLogWithActor,
  Database
} from '../../types/database.types';

export type NewComplaintInput = {
  institution_id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  assigned_department_id: string;
  assigned_officer_id?: string | null;
  due_at?: string | null;
  received_at?: string;
  created_by?: string | null;
  complainant_name?: string | null;
  complainant_email?: string | null;
  complainant_phone?: string | null;
  complainant_type?: string | null;
  student_roll_no?: string | null;
};

export interface ComplaintFilterOptions {
  search?: string;
  departmentId?: string;
  status?: ComplaintStatus | 'ALL';
  priority?: ComplaintPriority | 'ALL';
  sortBy?: 'recent' | 'due_date' | 'priority';
  page?: number;
  pageSize?: number;
}

export async function getComplaints(options: ComplaintFilterOptions = {}): Promise<{
  data: ComplaintWithRelations[];
  count: number;
}> {
  const {
    search,
    departmentId,
    status,
    priority,
    sortBy = 'recent',
    page = 1,
    pageSize = 20,
  } = options;

  let query = supabase
    .from('complaints')
    .select(`
      *,
      institution:institutions(*),
      department:departments(*),
      assigned_officer:profiles!complaints_assigned_officer_id_fkey(*),
      creator:profiles!complaints_created_by_fkey(*)
    `, { count: 'exact' });

  // Filtering
  if (departmentId && departmentId !== 'ALL') {
    query = query.eq('assigned_department_id', departmentId);
  }

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  if (priority && priority !== 'ALL') {
    query = query.eq('priority', priority);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`complaint_number.ilike.${term},title.ilike.${term},description.ilike.${term}`);
  }

  // Sorting
  if (sortBy === 'due_date') {
    query = query.order('due_at', { ascending: true, nullsFirst: false });
  } else if (sortBy === 'priority') {
    query = query.order('priority', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching complaints:', error.message);
    throw error;
  }

  return {
    data: (data as unknown as ComplaintWithRelations[]) || [],
    count: count || 0,
  };
}

export async function getComplaintById(id: string): Promise<ComplaintWithRelations | null> {
  const { data, error } = await supabase
    .from('complaints')
    .select(`
      *,
      institution:institutions(*),
      department:departments(*),
      assigned_officer:profiles!complaints_assigned_officer_id_fkey(*),
      creator:profiles!complaints_created_by_fkey(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error fetching complaint ${id}:`, error.message);
    return null;
  }

  return data as unknown as ComplaintWithRelations;
}

export async function getComplaintByNumberOrId(identifier: string): Promise<ComplaintWithRelations | null> {
  // Normalize input: strip surrounding spaces and spaces around hyphens (e.g. "AICTE - 2026 - 01001" -> "AICTE-2026-01001")
  const clean = identifier.trim().replace(/\s*-\s*/g, '-');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

  let query = supabase
    .from('complaints')
    .select(`
      *,
      institution:institutions(*),
      department:departments(*),
      assigned_officer:profiles!complaints_assigned_officer_id_fkey(*),
      creator:profiles!complaints_created_by_fkey(*)
    `);

  if (isUuid) {
    query = query.or(`id.eq.${clean},complaint_number.ilike.${clean}`);
  } else {
    query = query.ilike('complaint_number', clean);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`Error looking up complaint "${clean}":`, error.message);
    return null;
  }

  return data as unknown as ComplaintWithRelations;
}

export async function createComplaint(payload: NewComplaintInput): Promise<Database['public']['Tables']['complaints']['Row']> {
  const insertData: Database['public']['Tables']['complaints']['Insert'] = {
    institution_id: payload.institution_id,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    priority: payload.priority,
    status: 'Received',
    assigned_department_id: payload.assigned_department_id,
    assigned_officer_id: payload.assigned_officer_id || null,
    due_at: payload.due_at || null,
    received_at: payload.received_at || new Date().toISOString(),
    created_by: payload.created_by || null,
    complainant_name: payload.complainant_name || null,
    complainant_email: payload.complainant_email || null,
    complainant_phone: payload.complainant_phone || null,
    complainant_type: payload.complainant_type || null,
    student_roll_no: payload.student_roll_no || null,
  };

  const { data, error } = await supabase
    .from('complaints')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating complaint:', error.message);
    throw error;
  }

  return data as Database['public']['Tables']['complaints']['Row'];
}

export async function updateComplaintStatus(
  id: string,
  newStatus: ComplaintStatus
): Promise<void> {
  const { error } = await supabase
    .from('complaints')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    console.error(`Error updating status for complaint ${id}:`, error.message);
    throw error;
  }
}

export async function updateComplaintAssignment(
  id: string,
  departmentId: string,
  officerId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('complaints')
    .update({
      assigned_department_id: departmentId,
      assigned_officer_id: officerId,
    })
    .eq('id', id);

  if (error) {
    console.error(`Error updating assignment for complaint ${id}:`, error.message);
    throw error;
  }
}

export async function getComplaintUpdates(complaintId: string): Promise<ComplaintUpdateWithAuthor[]> {
  const { data, error } = await supabase
    .from('complaint_updates')
    .select(`
      *,
      author:profiles(*)
    `)
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`Error fetching updates for complaint ${complaintId}:`, error.message);
    throw error;
  }

  return (data as unknown as ComplaintUpdateWithAuthor[]) || [];
}

export async function addComplaintUpdate(
  complaintId: string,
  authorId: string,
  updateText: string
): Promise<void> {
  const { error } = await supabase
    .from('complaint_updates')
    .insert({
      complaint_id: complaintId,
      author_id: authorId,
      update_text: updateText,
    });

  if (error) {
    console.error(`Error adding update to complaint ${complaintId}:`, error.message);
    throw error;
  }
}

export async function getComplaintAssignments(complaintId: string): Promise<AssignmentWithRelations[]> {
  const { data, error } = await supabase
    .from('complaint_assignments')
    .select(`
      *,
      department:departments(*),
      officer:profiles!complaint_assignments_officer_id_fkey(*),
      assigner:profiles!complaint_assignments_assigned_by_fkey(*)
    `)
    .eq('complaint_id', complaintId)
    .order('assigned_at', { ascending: false });

  if (error) {
    console.error(`Error fetching assignments for complaint ${complaintId}:`, error.message);
    throw error;
  }

  return (data as unknown as AssignmentWithRelations[]) || [];
}

export async function getComplaintAuditHistory(complaintId: string): Promise<AuditLogWithActor[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      actor:profiles(*)
    `)
    .eq('entity_id', complaintId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching audit history for complaint ${complaintId}:`, error.message);
    throw error;
  }

  return (data as unknown as AuditLogWithActor[]) || [];
}
