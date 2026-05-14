import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types';

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
export const supabaseEnabled = true;

// ── Auth ──────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// ── Clients ───────────────────────────────────────────────
export async function fetchAllClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('jonesy_clients')
    .select('data')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { data: Client }) => row.data);
}

export async function upsertClient(client: Client): Promise<void> {
  const { error } = await supabase
    .from('jonesy_clients')
    .upsert({ id: client.id, data: client }, { onConflict: 'id' });
  if (error) throw error;
}

export async function removeClient(id: string): Promise<void> {
  const { error } = await supabase.from('jonesy_clients').delete().eq('id', id);
  if (error) throw error;
}

// ── Settings ──────────────────────────────────────────────
export async function fetchCompanyName(): Promise<string | null> {
  const { data } = await supabase
    .from('jonesy_settings')
    .select('value')
    .eq('key', 'company_name')
    .single();
  return data?.value ?? null;
}

export async function saveCompanyName(name: string): Promise<void> {
  await supabase
    .from('jonesy_settings')
    .upsert({ key: 'company_name', value: name }, { onConflict: 'key' });
}

// ── Daily Prospects ───────────────────────────────────────────────
export interface JonesyDailyProspect {
  id: string;
  date: string;              // 'YYYY-MM-DD'
  name: string;
  title: string;
  company: string;
  email: string;
  email_confidence: string;  // 'verified' | 'estimated'
  why: string;
  draft_subject: string;
  draft_body: string;
  status: string;            // 'pending' | 'added' | 'skipped'
}

export async function fetchTodayJonesyProspects(): Promise<JonesyDailyProspect[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('jonesy_daily_prospects')
    .select('*')
    .eq('date', today)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as JonesyDailyProspect[];
}

export async function updateJonesyProspectStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('jonesy_daily_prospects')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
