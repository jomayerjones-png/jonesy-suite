import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Client, SavedProposal, StageEvent, ThreadMessage, View,
  SAMPLE_CLIENTS, generateId,
} from './types';
import {
  supabase,
  fetchAllClients, upsertClient, removeClient,
  fetchCompanyName, saveCompanyName,
  signOut,
} from './lib/supabase';
import type { DailyProspect } from './lib/supabase';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import Auth             from './components/Auth';
import AnalyticsView    from './components/analytics/AnalyticsView';
import Header           from './components/Header';
import PipelineTracker  from './components/pipeline/PipelineTracker';
import WeeklyReport     from './components/report/WeeklyReport';
import ProposalGenerator from './components/proposal/ProposalGenerator';
import Roadmap          from './components/roadmap/Roadmap';

const LS_CLIENTS = 'life_suite_clients';
const LS_COMPANY = 'life_suite_company';

function readLocalClients(): Client[] | null {
  try {
    const raw = localStorage.getItem(LS_CLIENTS);
    if (raw) return JSON.parse(raw) as Client[];
  } catch { /* ignore */ }
  return null;
}

function writeLocalClients(clients: Client[]) {
  try { localStorage.setItem(LS_CLIENTS, JSON.stringify(clients)); } catch { /* ignore */ }
}

function writeLocalCompany(name: string) {
  try { localStorage.setItem(LS_COMPANY, name); } catch { /* ignore */ }
}

const today = () => new Date().toISOString().split('T')[0];

function App() {
  // undefined = not yet checked; null = no session; Session = logged in
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [guestMode, setGuestMode] = useState(() => localStorage.getItem('life_guest') === 'true');

  // ── Auth session check ────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const [view, setView]               = useState<View>('pipeline');
  const [loading, setLoading]         = useState(true);
  const [supabaseError, setSupabaseError] = useState(false);

  const [companyName, setCompanyNameState] = useState<string>(() =>
    localStorage.getItem(LS_COMPANY) ?? 'LIFE'
  );

  const [clients, setClientsState] = useState<Client[]>(() =>
    readLocalClients() ?? SAMPLE_CLIENTS
  );

  const channelRef = useRef<RealtimeChannel | null>(null);

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
    saveCompanyName(name).catch(err =>
      console.warn('[life-suite] Failed to save companyName:', err)
    );
  }, []);

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    if (!guestMode && session === undefined) return; // still checking auth
    if (!guestMode && session === null) return;      // not logged in, not guest
    let cancelled = false;
    async function bootstrap() {
      try {
        const [remoteClients, remoteCompany] = await Promise.all([
          fetchAllClients(),
          guestMode ? Promise.resolve(null) : fetchCompanyName(),
        ]);
        if (cancelled) return;

        if (remoteClients.length > 0) {
          setClients(remoteClients);
        } else if (!guestMode) {
          // Supabase is empty — seed it with the real pipeline data
          setClients(SAMPLE_CLIENTS);
          Promise.all(SAMPLE_CLIENTS.map(c => upsertClient(c))).catch(err =>
            console.warn('[life-suite] Failed to seed Supabase:', err)
          );
        }
        // In guest mode with empty Supabase → keep whatever is in localStorage/sample

        if (remoteCompany !== null) {
          setCompanyNameState(remoteCompany);
          writeLocalCompany(remoteCompany);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[life-suite] Supabase bootstrap failed, using local cache:', err);
        setSupabaseError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, guestMode]);

  // ── Realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const channel = supabase
      .channel('clients-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const incoming = (newRow as { data: Client }).data;
            setClients(prev => {
              const idx = prev.findIndex(c => c.id === incoming.id);
              if (idx !== -1 && JSON.stringify(prev[idx]) === JSON.stringify(incoming)) return prev;
              if (idx === -1) return [incoming, ...prev];
              const next = [...prev];
              next[idx] = incoming;
              return next;
            });
          }
          if (eventType === 'DELETE') {
            const deletedId = (oldRow as { id: string }).id;
            setClients(prev => prev.filter(c => c.id !== deletedId));
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Mutations ─────────────────────────────────────────────
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
    };
    setClients(prev => [newClient, ...prev]);
    upsertClient(newClient).catch(err => console.error('[life-suite] addClient:', err));
  }, [setClients]);

  const updateClient = useCallback((id: string, updates: Partial<Client>) => {
    setClients(prev => {
      const next = prev.map(c => (c.id === id ? { ...c, ...updates } : c));
      const updated = next.find(c => c.id === id);
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] updateClient:', err));
      return next;
    });
  }, [setClients]);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    removeClient(id).catch(err => console.error('[life-suite] deleteClient:', err));
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
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] moveClient:', err));
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
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] markClientLost:', err));
      return next;
    });
  }, [setClients]);

  const reactivateClient = useCallback((id: string) => {
    setClients(prev => {
      const next = prev.map(c =>
        c.id !== id ? c : { ...c, outcome: 'active' as const, lostReason: '' }
      );
      const updated = next.find(c => c.id === id);
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] reactivateClient:', err));
      return next;
    });
  }, [setClients]);

  const saveProposalToClient = useCallback((clientId: string, proposal: SavedProposal) => {
    setClients(prev => {
      const next = prev.map(c =>
        c.id === clientId ? { ...c, proposals: [...(c.proposals ?? []), proposal] } : c
      );
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] saveProposal:', err));
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
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] deleteProposal:', err));
      return next;
    });
  }, [setClients]);

  const updateProposalForClient = useCallback((
    clientId: string, proposalId: string, updates: Partial<SavedProposal>
  ) => {
    setClients(prev => {
      const next = prev.map(c =>
        c.id === clientId
          ? { ...c, proposals: (c.proposals ?? []).map(p => p.id === proposalId ? { ...p, ...updates } : p) }
          : c
      );
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] updateProposal:', err));
      return next;
    });
  }, [setClients]);

  const updateClientThread = useCallback((clientId: string, thread: ThreadMessage[]) => {
    setClients(prev => {
      const next = prev.map(c => c.id === clientId ? { ...c, thread } : c);
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] updateThread:', err));
      return next;
    });
  }, [setClients]);

  const updateClientMeetingNotes = useCallback((clientId: string, meetingNotes: import('./types').MeetingNote[]) => {
    setClients(prev => {
      const next = prev.map(c => c.id === clientId ? { ...c, meetingNotes } : c);
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] updateMeetingNotes:', err));
      return next;
    });
  }, [setClients]);

  const updateClientNewsCache = useCallback((clientId: string, newsCache: import('./types').Client['newsCache']) => {
    setClients(prev => {
      const next = prev.map(c => c.id === clientId ? { ...c, newsCache } : c);
      const updated = next.find(c => c.id === clientId);
      if (updated) upsertClient(updated).catch(err => console.error('[life-suite] updateNewsCache:', err));
      return next;
    });
  }, [setClients]);

  const addProspectToEngaged = useCallback((p: DailyProspect) => {
    addClient({
      name: p.name,
      company: p.company,
      email: p.email,
      phone: '',
      value: 500_000,
      stage: 'Engaged',
      notes: `Prospected via daily agent.\n\nWHY: ${p.why}\n\nDraft email subject: ${p.draft_subject}`,
      lastContact: today(),
      tags: ['prospected'],
      proposals: [],
      industry: '',
      outcome: 'active',
      lostReason: '',
      stageHistory: [],
    });
  }, [addClient]);

  // ── Auth guards ───────────────────────────────────────────
  const handleSignOut = () => {
    if (guestMode) {
      localStorage.removeItem('life_guest');
      setGuestMode(false);
    } else {
      signOut();
    }
  };

  if (!guestMode && session === undefined) return null; // checking session — blank flash
  if (!guestMode && session === null) return (
    <Auth onSkip={() => { localStorage.setItem('life_guest', 'true'); setGuestMode(true); }} />
  );

  // ── Loading screen ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="bg-[#E8002D] px-4 py-2 inline-block">
            <span className="font-display font-bold text-white text-3xl tracking-tighter leading-none">
              LIFE
            </span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-brand-dark/30 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-brand-dark/30 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-brand-dark/30 animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-xs text-brand-dark/40 uppercase tracking-widest font-medium">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-light flex flex-col">
      {supabaseError && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-amber-700 text-xs font-medium">
          <span>⚠</span>
          <span>Could not connect to the live database — showing locally cached data. Changes will not sync until connectivity is restored.</span>
        </div>
      )}
      <Header
        companyName={companyName}
        onCompanyNameChange={setCompanyName}
        activeView={view}
        onViewChange={setView}
        clientCount={clients.length}
        onSignOut={handleSignOut}
        guestMode={guestMode}
      />
      <main className="flex-1 overflow-auto pb-16 sm:pb-0">
        {view === 'pipeline' && (
          <PipelineTracker
            clients={clients}
            readOnly={guestMode}
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
            onUpdateMeetingNotes={updateClientMeetingNotes}
            onUpdateNewsCache={updateClientNewsCache}
          />
        )}
        {view === 'roadmap' && (
          <Roadmap companyName={companyName} onAddToEngaged={addProspectToEngaged} />
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
      </main>
      <footer className="no-print bg-white border-t border-brand-cream px-6 py-2 flex items-center justify-between">
        <p className="text-xs text-brand-dark/35 font-medium">
          CONFIDENTIAL — Property of LIFE. This tool and all information contained within is strictly private and confidential. Unauthorised access, use, or distribution is prohibited.
        </p>
        <p className="text-xs text-brand-dark/25 flex-shrink-0 ml-6">© {new Date().getFullYear()} LIFE</p>
      </footer>
    </div>
  );
}

export default App;
