import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ── Clients ───────────────────────────────────────────────
export async function fetchAllClients(): Promise<Client[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('data')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { data: Client }) => row.data);
}

export async function upsertClient(client: Client): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('clients')
    .upsert({ id: client.id, data: client }, { onConflict: 'id' });
  if (error) throw error;
}

export async function removeClient(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ── Settings ──────────────────────────────────────────────
export async function fetchCompanyName(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'company_name')
    .single();
  return data?.value ?? null;
}

export async function saveCompanyName(name: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('settings')
    .upsert({ key: 'company_name', value: name }, { onConflict: 'key' });
}
