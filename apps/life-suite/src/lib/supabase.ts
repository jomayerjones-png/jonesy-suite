import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types';

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// ── Auth ──────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ── Clients ───────────────────────────────────────────────
export async function fetchAllClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('data');
  if (error) throw error;
  return (data ?? []).map((row: { data: Client }) => row.data);
}

export async function upsertClient(client: Client): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .upsert({ id: client.id, data: client }, { onConflict: 'id' });
  if (error) throw error;
}

export async function removeClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCompanyName(): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'companyName')
    .single();
  if (error) return null;
  return (data as { value: string }).value ?? null;
}

export async function saveCompanyName(name: string): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'companyName', value: name }, { onConflict: 'key' });
  if (error) throw error;
}
