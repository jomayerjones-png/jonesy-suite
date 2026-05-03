import { useState, useEffect, useCallback } from 'react';
import { Client, SavedProposal, StageEvent, ThreadMessage, View, SAMPLE_CLIENTS, DATA_VERSION, generateId } from './types';
import { fetchAllClients, upsertClient, removeClient, KaleidoscopeDailyProspect } from './lib/supabase';
import AnalyticsView from './components/analytics/AnalyticsView';
import Header from './components/Header';
import PipelineTracker from './components/pipeline/PipelineTracker';
import WeeklyReport from './components/report/WeeklyReport';
import ProposalGenerator from './components/proposal/ProposalGenerator';
import Leads from './components/leads/Leads';

const STORAGE_KEY_CLIENTS = 'kaleidoscope_suite_clients';
const STORAGE_KEY_COMPANY = 'kaleidoscope_suite_company';
const STORAGE_KEY_VERSION = 'kaleidoscope_suite_data_version';

function App() {
  const [view, setView] = useState<View>('pipeline');
  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_COMPANY) ?? 'Kaleidoscope';
  });
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const storedVersion = localStorage.getItem(STORAGE_KEY_VERSION);
      if (storedVersion !== DATA_VERSION) {
        // New BD data available — reset to fresh pipeline
        localStorage.removeItem(STORAGE_KEY_CLIENTS);
        return SAMPLE_CLIENTS;
      }
      const stored = localStorage.getItem(STORAGE_KEY_CLIENTS);
      if (stored) return JSON.parse(stored) as Client[];
    } catch {
      // fall through
    }
    return SAMPLE_CLIENTS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    fetchAllClients()
      .then(remote => { if (remote.length > 0) setClients(remote); })
      .catch(() => { /* stay on localStorage */ });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COMPANY, companyName);
  }, [companyName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VERSION, DATA_VERSION);
  }, []);

  const today = () => new Date().toISOString().split('T')[0];

  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>) => {
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
    upsertClient(newClient).catch(() => {});
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...updates };
      upsertClient(updated).catch(() => {});
      return updated;
    }));
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    removeClient(id).catch(() => {});
  };

  const moveClient = (id: string, newStage: Client['stage']) => {
    const d = today();
    setClients(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        stage: newStage,
        lastContact: d,
        outcome: newStage === 'Close' ? 'won' : c.outcome,
        stageHistory: [...(c.stageHistory ?? []), { stage: newStage, date: d }],
      };
    }));
  };

  const markClientLost = (id: string, reason: string) => {
    const d = today();
    setClients(prev => prev.map(c =>
      c.id !== id ? c : {
        ...c,
        outcome: 'lost',
        lostReason: reason,
        stageHistory: [...(c.stageHistory ?? []), { stage: c.stage, date: d }],
      }
    ));
  };

  const reactivateClient = (id: string) => {
    setClients(prev => prev.map(c =>
      c.id !== id ? c : { ...c, outcome: 'active', lostReason: '' }
    ));
  };

  const saveProposalToClient = (clientId: string, proposal: SavedProposal) => {
    setClients(prev =>
      prev.map(c =>
        c.id === clientId ? { ...c, proposals: [...(c.proposals ?? []), proposal] } : c
      )
    );
  };

  const deleteProposalFromClient = (clientId: string, proposalId: string) => {
    setClients(prev =>
      prev.map(c =>
        c.id === clientId
          ? { ...c, proposals: (c.proposals ?? []).filter(p => p.id !== proposalId) }
          : c
      )
    );
  };

  const updateProposalForClient = (clientId: string, proposalId: string, updates: Partial<SavedProposal>) => {
    setClients(prev =>
      prev.map(c =>
        c.id === clientId
          ? { ...c, proposals: (c.proposals ?? []).map(p => p.id === proposalId ? { ...p, ...updates } : p) }
          : c
      )
    );
  };

  const updateClientThread = (clientId: string, thread: ThreadMessage[]) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, thread } : c));
  };

  const handleAddProspectToEngaged = useCallback((p: KaleidoscopeDailyProspect) => {
    addClient({
      name: p.name,
      company: p.company,
      email: p.email ?? '',
      phone: '',
      value: 0,
      stage: 'Engaged',
      notes: `Daily prospect. WHY: ${p.why}`,
      lastContact: new Date().toISOString().split('T')[0],
      tags: ['prospect', 'ai-generated'],
      proposals: [],
      industry: '',
      outcome: 'active',
      lostReason: '',
      stageHistory: [],
    });
  }, []);

  return (
    <div className="min-h-screen bg-brand-light flex flex-col">
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
          CONFIDENTIAL — Property of Kaleidoscope. This tool and all information contained within is strictly private and confidential. Unauthorised access, use, or distribution is prohibited.
        </p>
        <p className="text-xs text-brand-dark/25 flex-shrink-0 ml-6">© {new Date().getFullYear()} Kaleidoscope</p>
      </footer>
    </div>
  );
}

export default App;
