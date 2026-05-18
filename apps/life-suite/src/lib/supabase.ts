import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types';

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// ── Helpers ──────────────────────────────────────────────
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

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
    .from('clients')
    .select('data');
  if (error) throw error;
  return (data ?? []).map((row: { data: Client }) => row.data);
}

export async function upsertClient(client: Client): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('clients')
    .upsert({ id: client.id, data: client, user_id: userId }, { onConflict: 'id' });
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
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'companyName', value: name, user_id: userId }, { onConflict: 'key' });
  if (error) throw error;
}

// ── Daily Prospects ───────────────────────────────────────────────
export interface DailyProspect {
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

export async function fetchTodayProspects(): Promise<DailyProspect[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('daily_prospects')
    .select('*')
    .eq('date', today)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as DailyProspect[];
}

export async function updateProspectStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('daily_prospects')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ── Report Archives ───────────────────────────────────────────────
export async function fetchReportArchives(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('report_archives')
    .select('data')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { data: unknown }) => row.data);
}

export async function saveReportArchive(archive: Record<string, unknown>): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('report_archives')
    .upsert({ id: archive.id as string, data: archive, user_id: userId }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteReportArchive(id: string): Promise<void> {
  const { error } = await supabase.from('report_archives').delete().eq('id', id);
  if (error) throw error;
}
