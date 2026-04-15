// Data layer: reads from Supabase when env vars are configured,
// otherwise returns mock data so the deployed platform stays usable
// before the database is connected.

import { createServerSupabase } from '@/lib/supabase/server';
import type {
  Client,
  ServiceStage,
  PipelineProspect,
  ActionItem,
  ClientUpdate,
  Proposal,
  BDLead,
} from '@/lib/types';
import {
  MOCK_CLIENTS,
  MOCK_STAGES,
  MOCK_PROSPECTS,
  MOCK_ACTIONS,
  MOCK_UPDATES,
  MOCK_PROPOSALS,
  MOCK_BD_LEADS,
} from '@/lib/mockData';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function getClients(): Promise<Client[]> {
  if (!isSupabaseConfigured()) return MOCK_CLIENTS;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[getClients] Supabase error:', error.message);
    return MOCK_CLIENTS;
  }
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  if (!isSupabaseConfigured()) {
    return MOCK_CLIENTS.find((c) => c.id === id) ?? null;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getClient] Supabase error:', error.message);
    return null;
  }
  return (data as Client) ?? null;
}

// ---------------------------------------------------------------------------
// Service stages
// ---------------------------------------------------------------------------

export async function getServiceStages(
  clientId: string
): Promise<ServiceStage[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_STAGES.filter((s) => s.client_id === clientId);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('service_stages')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[getServiceStages] Supabase error:', error.message);
    return [];
  }
  return (data ?? []) as ServiceStage[];
}

// ---------------------------------------------------------------------------
// Pipeline prospects
// ---------------------------------------------------------------------------

export async function getPipelineProspects(
  clientId: string
): Promise<PipelineProspect[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_PROSPECTS.filter((p) => p.client_id === clientId);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('pipeline_prospects')
    .select('*')
    .eq('client_id', clientId)
    .order('last_activity_at', { ascending: false });

  if (error) {
    console.error('[getPipelineProspects] Supabase error:', error.message);
    return [];
  }
  return (data ?? []) as PipelineProspect[];
}

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

export async function getActionItems(clientId: string): Promise<ActionItem[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_ACTIONS.filter((a) => a.client_id === clientId);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .eq('client_id', clientId)
    .eq('completed', false)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[getActionItems] Supabase error:', error.message);
    return [];
  }
  return (data ?? []) as ActionItem[];
}

// ---------------------------------------------------------------------------
// Client updates (recent updates feed)
// ---------------------------------------------------------------------------

export async function getClientUpdates(
  clientId: string,
  limit = 20
): Promise<ClientUpdate[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_UPDATES.filter((u) => u.client_id === clientId).slice(0, limit);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('client_updates')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getClientUpdates] Supabase error:', error.message);
    return [];
  }
  return (data ?? []) as ClientUpdate[];
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export async function getProposals(clientId: string): Promise<Proposal[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_PROPOSALS.filter((p) => p.client_id === clientId);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[getProposals] Supabase error:', error.message);
    return [];
  }
  return (data ?? []) as Proposal[];
}

// ---------------------------------------------------------------------------
// BD Leads (org-wide)
// ---------------------------------------------------------------------------

export async function getBDLeads(): Promise<BDLead[]> {
  if (!isSupabaseConfigured()) return MOCK_BD_LEADS;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('bd_leads')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[getBDLeads] Supabase error:', error.message);
    return [];
  }
  return (data ?? []) as BDLead[];
}
