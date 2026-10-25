import { supabase } from './client';
import type { Database, UserRole } from '../../types/database.types';

export type UserProfile = Database['public']['Tables']['profiles']['Row'] & {
  departments?: Database['public']['Tables']['departments']['Row'] | null;
};

export async function getProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      departments(*)
    `)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error fetching user profiles:', error.message);
    throw error;
  }

  return (data as unknown as UserProfile[]) || [];
}

export async function getOfficersByDepartment(departmentId?: string): Promise<UserProfile[]> {
  let query = supabase
    .from('profiles')
    .select(`
      *,
      departments(*)
    `)
    .order('full_name', { ascending: true });

  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching officers:', error.message);
    throw error;
  }

  return (data as unknown as UserProfile[]) || [];
}

export async function updateUserRoleOrDept(
  userId: string,
  role: UserRole,
  departmentId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      role,
      department_id: departmentId,
    })
    .eq('id', userId);

  if (error) {
    console.error(`Error updating role/dept for user ${userId}:`, error.message);
    throw error;
  }
}
