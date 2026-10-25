import { supabase } from './client';
import type { Database } from '../../types/database.types';

export type Institution = Database['public']['Tables']['institutions']['Row'];
export type NewInstitution = Database['public']['Tables']['institutions']['Insert'];

export async function getInstitutions(searchTerm?: string): Promise<Institution[]> {
  let query = supabase
    .from('institutions')
    .select('*')
    .order('institution_name', { ascending: true });

  if (searchTerm && searchTerm.trim()) {
    const term = `%${searchTerm.trim()}%`;
    query = query.or(`institution_name.ilike.${term},aicte_permanent_id.ilike.${term},state.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching institutions:', error.message);
    throw error;
  }

  return data || [];
}

export async function createInstitution(institution: NewInstitution): Promise<Institution> {
  const { data, error } = await supabase
    .from('institutions')
    .insert(institution)
    .select()
    .single();

  if (error) {
    console.error('Error creating institution:', error.message);
    throw error;
  }

  return data;
}
