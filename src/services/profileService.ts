import { getSupabaseClient } from '../utils/supabaseDebug';
import type { ProfileListItem, User } from '../types';

type StoredProfile = Omit<ProfileListItem, 'ownerName' | 'ownerUsername' | 'ownerRole'>;
type ProfileInsertPayload = Omit<StoredProfile, 'id'>;

export async function fetchProfiles(isAdmin: boolean, userId: string | number): Promise<StoredProfile[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  let query = supabase.from('profiles').select('*');
  if (!isAdmin) query = query.eq('userId', userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StoredProfile[];
}

export async function fetchProfileById(id: string | number): Promise<StoredProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as StoredProfile;
}

export async function insertProfile(payload: ProfileInsertPayload): Promise<StoredProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as StoredProfile;
}

export async function updateProfileById(id: string | number, payload: ProfileInsertPayload): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteProfileById(id: string | number): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchUsers(): Promise<User[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, name, userRole');

  if (error) throw error;
  return (data ?? []) as User[];
}

export type { StoredProfile, ProfileInsertPayload };
