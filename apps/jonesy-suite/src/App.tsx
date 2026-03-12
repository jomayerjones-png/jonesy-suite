import { useState, useEffect } from 'react';
import { Client, SavedProposal, StageEvent, View, SAMPLE_CLIENTS, generateId } from './types';
import AnalyticsView from './components/analytics/AnalyticsView';
import Header from './components/Header';
import PipelineTracker from './components/pipeline/PipelineTracker';
import WeeklyReport from './components/report/WeeklyReport';
import ProposalGenerator from './components/proposal/ProposalGenerator';

const STORAGE_KEY_CLIENTS = 'jonesy_suite_clients';
const STORAGE_KEY_COMPANY = 'jonesy_suite_company';

function App() {
  const [view, setView] = useState<View>('pipeline');
  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_COMPANY) ?? 'Jonesy&Co';
  });
  const [clients, setClients] = useState<Client[]>(() => {
    try {
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
    localStorage.setItem(STORAGE_KEY_COMPANY, companyName);
  }, [companyName]);

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
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
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
            onAdd={addClient}
            onUpdate={updateClient}
            onDelete={deleteClient}
            onMove={moveClient}
            onMarkLost={markClientLost}
            onReactivate={reactivateClient}
            onDeleteProposal={deleteProposalFromClient}
            onAddProposal={saveProposalToClient}
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
      </main>
    </div>
  );
}

export default App;
