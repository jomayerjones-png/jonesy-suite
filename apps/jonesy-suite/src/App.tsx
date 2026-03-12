import { useState, useEffect } from 'react';
import { Client, SavedProposal, View, SAMPLE_CLIENTS, generateId } from './types';
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

  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = {
      ...clientData,
      id: generateId(),
      createdAt: new Date().toISOString().split('T')[0],
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
    updateClient(id, { stage: newStage, lastContact: new Date().toISOString().split('T')[0] });
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
            onDeleteProposal={deleteProposalFromClient}
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
      </main>
    </div>
  );
}

export default App;
