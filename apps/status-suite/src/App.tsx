import { useState, useEffect, useCallback } from 'react';
import { Client, SavedProposal, ThreadMessage, View, SAMPLE_CLIENTS, generateId } from './types';
import {
  supabase,
  fetchAllClients, upsertClient, removeClient,
  fetchCompanyName, saveCompanyName, signOut,
  StatusDailyProspect,
} from './lib/supabase';
import Auth from './components/Auth';
import AnalyticsView from './components/analytics/AnalyticsView';
import Header from './components/Header';
import PipelineTracker from './components/pipeline/PipelineTracker';
import WeeklyReport from './components/report/WeeklyReport';
import ProposalGenerator from './components/proposal/ProposalGenerator';
import Leads from './components/leads/Leads';

const STORAGE_KEY_CLIENTS = 'status_suite_clients';
const STORAGE_KEY_COMPANY = 'status_suite_company';

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
  const [view, setView]       = useState<View>('pipeline');
  const [authed, setAuthed]   = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => subscription.unsubscribe();
  }, []);

  const [companyName, setCompanyNameState] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY_COMPANY) ?? 'STATUS'
  );
  const [clients, setClientsState] = useState<Client[]>(() =>
    readLocalClients() ?? SAMPLE_CLIENTS
  );

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

  // Bootstrap from Supabase on login
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const [remote, remoteName] = await Promise.all([fetchAllClients(), fetchCompanyName()]);
        if (cancelled) return;
        if (remote.length > 0) setClients(remote);
        else if (SAMPLE_CLIENTS.length > 0) {
          setClients(SAMPLE_CLIENTS);
          SAMPLE_CLIENTS.forEach(c => upsertClient(c).catch(console.warn));
        }
        if (remoteName) { setCompanyNameState(remoteName); writeLocalCompany(remoteName); }
      } catch (err) {
        if (!cancelled) { console.error('[status] Supabase bootstrap failed:', err); setDbError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // ── Mutations ─────────────────────────────────────────
  const addClient = useCallback((clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = {
      ...clientData,
      id: generateId(),
      createdAt: today(),
      industry: clientData.industry || '',
      outcome: clientData.outcome || 'active',
      lostReason: clientData.lostReason || '',
      stageHistory: clientData.stageHistory?.length
        ? clientData.stageHistory
        : [{ stage: clientData.stage, date: today() }],
    };
    setClients(prev => [newClient, ...prev]);
    upsertClient(newClient).catch(console.error);
  }, [setClients]);

  const updateClient = useCallback((id: string, updates: Partial<Client>) => {
    setClients(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...updates } : c);
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

  const updateClientThread = useCallback((clientId: string, thread: ThreadMessage[]) => {
    setClients(prev => {
      const next = prev.map(c => c.id === clientId ? { ...c, thread } : c);
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(console.error);
      return next;
    });
  }, [setClients]);

  const handleAddProspectToEngaged = useCallback((p: StatusDailyProspect) => {
    addClient({
      name: p.name,
      company: p.company,
      email: p.email ?? '',
      phone: '',
      value: 0,
      stage: 'Engaged',
      notes: `Daily prospect. WHY: ${p.why}`,
      lastContact: today(),
      tags: ['prospect', 'ai-generated'],
      proposals: [],
      industry: '',
      outcome: 'active',
      lostReason: '',
      stageHistory: [],
    });
  }, [addClient]);

  // ── Auth / loading gates ──────────────────────────────
  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F0EB' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-dark/20 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-brand-dark/20 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-brand-dark/20 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (!authed) return <Auth />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F0EB' }}>
        <div className="text-center space-y-4">
          <div className="inline-block bg-[#E8471C] px-4 py-2">
            <span className="font-sans font-bold text-white text-xl tracking-[0.15em] uppercase">STATUS</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-brand-dark/20 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-brand-dark/20 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-brand-dark/20 animate-bounce [animation-delay:300ms]" />
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
      />
      <main className="flex-1 overflow-auto">
        {view === 'pipeline' && (
          <PipelineTracker
            clients={clients}
            allClients={clients}
            defaultNewStage="Prospect"
            onAdd={addClient}
            onUpdate={updateClient}
            onDelete={deleteClient}
            onMove={moveClient}
            onMarkLost={markClientLost}
            onReactivate={reactivateClient}
            onDeleteProposal={deleteProposalFromClient}
            onAddProposal={saveProposalToClient}
            onUpdateProposal={updateProposalForClient}
            onUpdateThread={updateClientThread}
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
        {view === 'leads' && (
          <Leads onAddToEngaged={handleAddProspectToEngaged} />
        )}
        {view === 'analytics' && (
          <AnalyticsView clients={clients} companyName={companyName} />
        )}
      </main>
      <footer className="no-print bg-white border-t border-brand-cream px-6 py-2 flex items-center justify-between">
        <p className="text-xs text-brand-dark/35 font-medium">
          CONFIDENTIAL — Property of STATUS. Strictly private and confidential.
        </p>
        <div className="flex items-center gap-4">
          <p className="text-xs text-brand-dark/25">© {new Date().getFullYear()} STATUS</p>
          <button onClick={() => signOut()} className="text-xs text-brand-dark/25 hover:text-brand-dark/50 transition-colors">
            Sign out
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
