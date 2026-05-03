import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types';

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export async function fetchAllClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('status_clients').select('data');
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

// ── Report Archives ──────────────────────────────────────────────

export interface ReportArchiveRow {
  id: string;
  week_label: string;
  saved_at: string;
  company_name: string;
  notes: Record<string, string>;
  stats: Record<string, unknown>;
}

export async function fetchReportArchives(): Promise<ReportArchiveRow[]> {
  const { data, error } = await supabase
    .from('status_report_archives')
    .select('*')
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReportArchiveRow[];
}

export async function saveReportArchive(row: ReportArchiveRow): Promise<void> {
  const { error } = await supabase
    .from('status_report_archives')
    .upsert(row, { onConflict: 'id' });
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
