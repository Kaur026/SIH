import { supabase } from './client';
import type { Database } from '../../types/database.types';

export type Department = Database['public']['Tables']['departments']['Row'];

export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching departments:', error.message);
    throw error;
  }

  return data || [];
}

export async function getDepartmentById(id: string): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error fetching department ${id}:`, error.message);
    return null;
  }

  return data;
}
