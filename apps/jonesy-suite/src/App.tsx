import { useState, useEffect, useRef, useCallback } from 'react';
import { Client, SavedProposal, StageEvent, View, SAMPLE_CLIENTS, generateId } from './types';
import {
  supabase, supabaseEnabled,
  fetchAllClients, upsertClient, removeClient,
  fetchCompanyName, saveCompanyName,
} from './lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  gmailEnabled, initGmailClient, requestGmailAccess,
  getStoredToken, fetchRecentEmails, matchEmailsToContacts,
  LS_LAST_SYNC,
} from './lib/gmail';
import AnalyticsView from './components/analytics/AnalyticsView';
import Header from './components/Header';
import PipelineTracker from './components/pipeline/PipelineTracker';
import WeeklyReport from './components/report/WeeklyReport';
import ProposalGenerator from './components/proposal/ProposalGenerator';
import LiveProjects from './components/projects/LiveProjects';

const STORAGE_KEY_CLIENTS = 'jonesy_suite_clients';
const STORAGE_KEY_COMPANY  = 'jonesy_suite_company';

function readLocalClients(): Client[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (raw) return JSON.parse(raw) as Client[];
  } catch { /* ignore */ }
  return null;
}
function writeLocalClients(clients: Client[]) {
  try { localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients)); } catch { /* ignore */ }
}
function writeLocalCompany(name: string) {
  try { localStorage.setItem(STORAGE_KEY_COMPANY, name); } catch { /* ignore */ }
}

const today = () => new Date().toISOString().split('T')[0];

function App() {
  const [view, setView]     = useState<View>('pipeline');
  const [loading, setLoading] = useState(supabaseEnabled);
  const [dbError, setDbError] = useState(false);

  const [companyName, setCompanyNameState] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY_COMPANY) ?? 'Jonesy & Co'
  );
  const [clients, setClientsState] = useState<Client[]>(() =>
    readLocalClients() ?? SAMPLE_CLIENTS
  );

  // Gmail state
  const [gmailToken, setGmailToken] = useState<string | null>(getStoredToken);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(
    () => localStorage.getItem(LS_LAST_SYNC)
  );

  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Setters that also write to localStorage ───────────
  const setClients = useCallback((updater: Client[] | ((prev: Client[]) => Client[])) => {
    setClientsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeLocalClients(next);
      return next;
    });
  }, []);

  const setCompanyName = useCallback((name: string) => {
    setCompanyNameState(name);
    writeLocalCompany(name);
    saveCompanyName(name).catch(console.warn);
  }, []);

  // ── Supabase bootstrap ────────────────────────────────
  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [remote, remoteName] = await Promise.all([fetchAllClients(), fetchCompanyName()]);
        if (cancelled) return;
        if (remote.length > 0) {
          setClients(remote);
        } else if (SAMPLE_CLIENTS.length > 0) {
          setClients(SAMPLE_CLIENTS);
          SAMPLE_CLIENTS.forEach(c => upsertClient(c).catch(console.warn));
        }
        if (remoteName) { setCompanyNameState(remoteName); writeLocalCompany(remoteName); }
      } catch (err) {
        if (!cancelled) { console.error('[jonesy] Supabase bootstrap failed:', err); setDbError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase realtime ─────────────────────────────────
  useEffect(() => {
    if (!supabase || loading) return;
    const channel = supabase
      .channel('jonesy-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const incoming = (newRow as { data: Client }).data;
          setClients(prev => {
            const idx = prev.findIndex(c => c.id === incoming.id);
            if (idx !== -1 && JSON.stringify(prev[idx]) === JSON.stringify(incoming)) return prev;
            if (idx === -1) return [incoming, ...prev];
            const next = [...prev]; next[idx] = incoming; return next;
          });
        }
        if (eventType === 'DELETE') {
          const deletedId = (oldRow as { id: string }).id;
          setClients(prev => prev.filter(c => c.id !== deletedId));
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase?.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Gmail init ────────────────────────────────────────
  useEffect(() => {
    if (!gmailEnabled) return;
    initGmailClient(token => {
      setGmailToken(token);
    });
  }, []);

  // ── Gmail sync ────────────────────────────────────────
  const syncGmail = useCallback(async (token: string) => {
    setGmailSyncing(true);
    try {
      const emails = await fetchRecentEmails(token);
      const updates = matchEmailsToContacts(emails, clients);
      if (updates.length > 0) {
        setClients(prev => prev.map(c => {
          const update = updates.find(u => u.id === c.id);
          if (!update) return c;
          const updated = { ...c, lastContact: update.lastContact, gmailSynced: true, emailCount: update.emailCount };
          upsertClient(updated).catch(console.warn);
          return updated;
        }));
      }
      const now = new Date().toISOString();
      localStorage.setItem(LS_LAST_SYNC, now);
      setLastSync(now);
    } catch (err) {
      console.error('[jonesy] Gmail sync failed:', err);
    } finally {
      setGmailSyncing(false);
    }
  }, [clients, setClients]);

  // Auto-sync on load if token available
  useEffect(() => {
    if (gmailToken) syncGmail(gmailToken);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailToken]);

  const handleConnectGmail = useCallback(() => {
    if (gmailToken) {
      syncGmail(gmailToken);
    } else {
      requestGmailAccess();
    }
  }, [gmailToken, syncGmail]);

  // ── Mutations ─────────────────────────────────────────
  const addClient = useCallback((clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const initHistory: StageEvent[] = [{ stage: clientData.stage, date: today() }];
    const newClient: Client = {
      ...clientData,
      id: generateId(),
      createdAt: today(),
      industry: clientData.industry || '',
      outcome: clientData.outcome || 'active',
      lostReason: clientData.lostReason || '',
      stageHistory: clientData.stageHistory?.length ? clientData.stageHistory : initHistory,
      documents: clientData.documents ?? [],
    };
    setClients(prev => [newClient, ...prev]);
    upsertClient(newClient).catch(console.error);
  }, [setClients]);

  const updateClient = useCallback((id: string, updates: Partial<Client>) => {
    setClients(prev => {
      const next = prev.map(c => (c.id === id ? { ...c, ...updates } : c));
      const updated = next.find(c => c.id === id);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    removeClient(id).catch(console.error);
  }, [setClients]);

  const moveClient = useCallback((id: string, newStage: Client['stage']) => {
    const d = today();
    setClients(prev => {
      const next = prev.map(c => {
        if (c.id !== id) return c;
        return {
          ...c, stage: newStage, lastContact: d,
          outcome: newStage === 'Close' ? 'won' : c.outcome,
          stageHistory: [...(c.stageHistory ?? []), { stage: newStage, date: d }],
        };
      });
      const updated = next.find(c => c.id === id);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  const markClientLost = useCallback((id: string, reason: string) => {
    const d = today();
    setClients(prev => {
      const next = prev.map(c =>
        c.id !== id ? c : {
          ...c, outcome: 'lost' as const, lostReason: reason,
          stageHistory: [...(c.stageHistory ?? []), { stage: c.stage, date: d }],
        }
      );
      const updated = next.find(c => c.id === id);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  const reactivateClient = useCallback((id: string) => {
    setClients(prev => {
      const next = prev.map(c =>
        c.id !== id ? c : { ...c, outcome: 'active' as const, lostReason: '' }
      );
      const updated = next.find(c => c.id === id);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  const saveProposalToClient = useCallback((clientId: string, proposal: SavedProposal) => {
    setClients(prev => {
      const next = prev.map(c =>
        c.id === clientId ? { ...c, proposals: [...(c.proposals ?? []), proposal] } : c
      );
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  const deleteProposalFromClient = useCallback((clientId: string, proposalId: string) => {
    setClients(prev => {
      const next = prev.map(c =>
        c.id === clientId
          ? { ...c, proposals: (c.proposals ?? []).filter(p => p.id !== proposalId) }
          : c
      );
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  const updateProposalForClient = useCallback((clientId: string, proposalId: string, updates: Partial<SavedProposal>) => {
    setClients(prev => {
      const next = prev.map(c =>
        c.id === clientId
          ? { ...c, proposals: (c.proposals ?? []).map(p => p.id === proposalId ? { ...p, ...updates } : p) }
          : c
      );
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  // ── Loading screen ────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white font-display text-3xl font-bold tracking-widest">JMJ</div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light flex flex-col">
      {dbError && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-amber-700 text-xs font-medium">
          <span>⚠</span>
          <span>Database unavailable — showing locally cached data. Changes will not sync.</span>
        </div>
      )}
      <Header
        companyName={companyName}
        onCompanyNameChange={setCompanyName}
        activeView={view}
        onViewChange={setView}
        clientCount={clients.length}
        wonRevenue={clients.filter(c => c.outcome === 'won' || c.stage === 'Close').reduce((sum, c) => sum + c.value, 0)}
        gmailEnabled={gmailEnabled}
        gmailConnected={Boolean(gmailToken)}
        gmailSyncing={gmailSyncing}
        lastSync={lastSync}
        onGmailConnect={handleConnectGmail}
      />
      <main className="flex-1 overflow-auto">
        {view === 'pipeline' && (
          <PipelineTracker
            clients={clients}
            onAdd={addClient}
            onUpdate={updateClient}
            onDelete={deleteClient}
            onMove={moveClient}
            onMarkLost={markClientLost}
            onReactivate={reactivateClient}
            onDeleteProposal={deleteProposalFromClient}
            onAddProposal={saveProposalToClient}
            onUpdateProposal={updateProposalForClient}
          />
        )}
        {view === 'report' && (
          <WeeklyReport clients={clients} companyName={companyName} />
        )}
        {view === 'proposal' && (
          <ProposalGenerator
            companyName={companyName}
            clients={clients}
            onSaveToClient={saveProposalToClient}
          />
        )}
        {view === 'analytics' && (
          <AnalyticsView clients={clients} companyName={companyName} />
        )}
        {view === 'projects' && (
          <LiveProjects clients={clients} onUpdateClient={updateClient} />
        )}
      </main>
      <footer className="no-print bg-brand-dark border-t border-white/10 px-6 py-2 flex items-center justify-between">
        <p className="text-xs text-white/25 font-medium">
          CONFIDENTIAL — Property of Jonesy &amp; Co. Strictly private.
        </p>
        <p className="text-xs text-white/20 flex-shrink-0 ml-6">© {new Date().getFullYear()} JMJ</p>
      </footer>
    </div>
  );
}

export default App;
