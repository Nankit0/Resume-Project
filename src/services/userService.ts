import { getSupabaseClient } from '../utils/supabaseDebug';
import type { User } from '../types';

type UserInsertPayload = Omit<User, 'id'>;
type UserUpdatePayload = Partial<Omit<User, 'id'>>;

export async function fetchAllUsers(): Promise<User[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, name, userRole, isActive, password');

  if (error) throw error;
  return (data ?? []) as User[];
}

export async function insertUser(payload: UserInsertPayload): Promise<User> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('users')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

export async function updateUserById(id: string | number, payload: UserUpdatePayload): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteUserById(id: string | number): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
