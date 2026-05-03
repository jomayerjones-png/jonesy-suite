import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types';

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export async function fetchAllClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('kaleidoscope_clients').select('data');
  if (error) throw error;
  return (data ?? []).map((row: { data: Client }) => row.data);
}

export async function upsertClient(client: Client): Promise<void> {
  const { error } = await supabase
    .from('kaleidoscope_clients')
    .upsert({ id: client.id, data: client }, { onConflict: 'id' });
  if (error) throw error;
}

export async function removeClient(id: string): Promise<void> {
  const { error } = await supabase.from('kaleidoscope_clients').delete().eq('id', id);
  if (error) throw error;
}

// ── Daily Prospects ──────────────────────────────────────────────

export interface KaleidoscopeDailyProspect {
  id: string;
  date: string;
  name: string;
  title: string;
  company: string;
  email: string;
  email_confidence: string;
  why: string;
  draft_subject: string;
  draft_body: string;
  status: string;
}

export async function fetchTodayKaleidoscopeProspects(): Promise<KaleidoscopeDailyProspect[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('kaleidoscope_daily_prospects')
    .select('*')
    .eq('date', today)
    .order('created_at' as string);
  if (error) throw error;
  return (data ?? []) as KaleidoscopeDailyProspect[];
}

export async function updateKaleidoscopeProspectStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('kaleidoscope_daily_prospects')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
