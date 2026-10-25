import { supabase } from './client';
import type { Database, UserRole } from '../../types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*, departments(*)')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching current user profile:', error.message);
    return null;
  }

  return data as Profile;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function registerUser(params: {
  email: string;
  password: string;
  fullName: string;
  departmentId: string;
  role: UserRole;
  designation?: string;
  contactNumber?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.fullName,
        department_id: params.departmentId,
        role: params.role,
        designation: params.designation || 'Desk Officer',
        contact_number: params.contactNumber || '',
      },
    },
  });

  if (error) throw error;
  return data;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
