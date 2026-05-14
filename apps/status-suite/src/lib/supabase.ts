import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types';

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

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
  const { data, error } = await supabase.from('status_clients').select('data').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { data: Client }) => row.data);
}

export async function upsertClient(client: Client): Promise<void> {
  const { error } = await supabase
    .from('status_clients')
    .upsert({ id: client.id, data: client }, { onConflict: 'id' });
  if (error) throw error;
}

export async function removeClient(id: string): Promise<void> {
  const { error } = await supabase.from('status_clients').delete().eq('id', id);
  if (error) throw error;
}

// ── Settings ──────────────────────────────────────────────
export async function fetchCompanyName(): Promise<string | null> {
  const { data } = await supabase.from('status_settings').select('value').eq('key', 'company_name').single();
  return data?.value ?? null;
}

export async function saveCompanyName(name: string): Promise<void> {
  await supabase.from('status_settings').upsert({ key: 'company_name', value: name }, { onConflict: 'key' });
}

// ── Report Archives ──────────────────────────────────────────────

export async function fetchReportArchives(): Promise<unknown[]> {
  const { data, error } = await supabase.from('status_report_archives').select('data').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { data: unknown }) => row.data);
}

export async function saveReportArchive(archive: { id: string; [key: string]: unknown }): Promise<void> {
  const { error } = await supabase.from('status_report_archives').upsert({ id: archive.id, data: archive }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteReportArchive(id: string): Promise<void> {
  const { error } = await supabase.from('status_report_archives').delete().eq('id', id);
  if (error) throw error;
}

// ── Daily Prospects ──────────────────────────────────────────────

export interface StatusDailyProspect {
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

export async function fetchTodayStatusProspects(): Promise<StatusDailyProspect[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('status_daily_prospects')
    .select('*')
    .eq('date', today)
    .order('created_at' as string);
  if (error) throw error;
  return (data ?? []) as StatusDailyProspect[];
}

export async function updateStatusProspectStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('status_daily_prospects')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
