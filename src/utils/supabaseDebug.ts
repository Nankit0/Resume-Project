import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export let supabase: SupabaseClient | null = null;

const PUBLIC_TABLE_CANDIDATES = ['users', 'profiles', 'jdFetches'] as const;

async function probeTable(
  client: SupabaseClient,
  tableName: string,
): Promise<{ ok: boolean; error?: unknown }> {
  const { error } = await client.from(tableName).select('*', { head: true, count: 'exact' }).limit(1);
  if (error) return { ok: false, error };
  return { ok: true };
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

export async function initSupabaseDebug(): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase error:- ', new Error('Missing Supabase environment configuration'));
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    console.error('Supabase error:- ', new Error('Unable to initialize client'));
    return;
  }

  let connected = false;
  let connectError: unknown = null;

  for (const tableName of PUBLIC_TABLE_CANDIDATES) {
    const result = await probeTable(client, tableName);
    if (result.ok) {
      connected = true;
      break;
    }
    connectError = result.error;
  }

  if (connected) {
    console.log('Supabase connected');
  } else {
    console.error('Supabase error:- ', connectError);
  }

  try {
    const tableResults = await Promise.all(
      PUBLIC_TABLE_CANDIDATES.map(async (tableName) => {
        const result = await probeTable(client, tableName);
        return result.ok ? tableName : null;
      }),
    );

    const tableNames = tableResults.filter((name): name is 'users' | 'profiles' | 'jdFetches' => name !== null);
    if (tableNames.length > 0) {
      console.log('Tables:', tableNames);
      return;
    }

    throw new Error('No accessible public tables found');
  } catch (error) {
    console.error(error);
  }
}
