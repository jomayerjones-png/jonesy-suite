import { useState, useEffect, useCallback } from 'react';
import { Client, SavedProposal, ThreadMessage, View, PipelineStage, SAMPLE_CLIENTS, generateId } from './types';
import {
  supabase,
  fetchAllClients, upsertClient, removeClient,
  fetchCompanyName, saveCompanyName, signOut,
  KaleidoscopeDailyProspect,
} from './lib/supabase';
import Auth from './components/Auth';
import AnalyticsView from './components/analytics/AnalyticsView';
import Header from './components/Header';
import PipelineTracker from './components/pipeline/PipelineTracker';
import WeeklyReport from './components/report/WeeklyReport';
import ProposalGenerator from './components/proposal/ProposalGenerator';
import Leads from './components/leads/Leads';
import Roadmap from './components/roadmap/Roadmap';

const STORAGE_KEY_CLIENTS = 'kaleidoscope_suite_clients';
const STORAGE_KEY_COMPANY = 'kaleidoscope_suite_company';

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
    localStorage.getItem(STORAGE_KEY_COMPANY) ?? 'Kaleidoscope'
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
        if (!cancelled) { console.error('[kaleidoscope] Supabase bootstrap failed:', err); setDbError(true); }
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

  const handleAddProspectToEngaged = useCallback((p: KaleidoscopeDailyProspect) => {
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

  // ── Airtable import ─────────────────────────────────
  const [showAirtableImport, setShowAirtableImport] = useState(false);
  const [airtableToken, setAirtableToken] = useState(() => localStorage.getItem('kaleidoscope_airtable_token') ?? '');
  const [airtableImporting, setAirtableImporting] = useState(false);
  const [airtableError, setAirtableError] = useState('');
  const [airtableResult, setAirtableResult] = useState('');

  const AIRTABLE_BASE_ID = 'appmRe5dF9c2ESygI';

  const probabilityToStage = (prob: number): PipelineStage => {
    if (prob >= 90) return 'Close';
    if (prob >= 50) return 'Proposal Sent';
    if (prob >= 20) return 'Engaged';
    return 'Prospect';
  };

  const handleAirtableImport = async () => {
    const token = airtableToken.trim();
    if (!token) { setAirtableError('Enter your Airtable Personal Access Token.'); return; }
    localStorage.setItem('kaleidoscope_airtable_token', token);
    setAirtableError('');
    setAirtableResult('');
    setAirtableImporting(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const log: string[] = [];

      // Step 1: try metadata API to discover tables — find the DEALS table
      let tableId = '';
      let tableName = '';
      try {
        const metaResp = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, { headers });
        log.push(`Meta API: ${metaResp.status}`);
        if (metaResp.ok) {
          const metaData = await metaResp.json() as { tables: { id: string; name: string; fields?: { name: string }[] }[] };
          log.push(`Tables: ${metaData.tables.map(t => t.name).join(', ')}`);
          const dealFields = ['$ Amount', 'Probability', 'Last touchpoint'];
          for (const t of metaData.tables) {
            const fieldNames = (t.fields ?? []).map(f => f.name);
            if (dealFields.some(df => fieldNames.includes(df))) {
              tableId = t.id;
              tableName = t.name;
              log.push(`Matched deals table: "${t.name}" (has ${dealFields.filter(df => fieldNames.includes(df)).join(', ')})`);
              break;
            }
          }
          if (!tableId && metaData.tables.length > 0) {
            tableId = metaData.tables[0].id;
            tableName = metaData.tables[0].name;
            log.push(`No deals table found, falling back to first: "${tableName}"`);
          }
        } else {
          const errText = await metaResp.text();
          log.push(`Meta error: ${errText.slice(0, 200)}`);
        }
      } catch (e) {
        log.push(`Meta exception: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Step 2: if no table from metadata, try common names
      if (!tableId) {
        const TABLE_NAMES = ['Table 1', 'Deals', 'Pipeline', 'Clients', 'CRM', 'Main', 'Contacts', 'Sponsors'];
        for (const name of TABLE_NAMES) {
          try {
            const resp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(name)}?maxRecords=1`, { headers });
            if (resp.ok) {
              tableName = name;
              tableId = name;
              log.push(`Found table by name: "${name}"`);
              break;
            }
          } catch { /* skip */ }
        }
      }

      if (!tableId) {
        throw new Error(`Could not find any table. Debug: ${log.join(' | ')}`);
      }

      // Step 3: fetch all records
      let rawRecords: { id: string; fields: Record<string, unknown> }[] = [];
      let offset: string | undefined;
      do {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableId)}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Fetch records failed (${resp.status}): ${errText.slice(0, 200)}`);
        }
        const data = await resp.json() as { records: { id: string; fields: Record<string, unknown> }[]; offset?: string };
        rawRecords = [...rawRecords, ...data.records];
        offset = data.offset;
      } while (offset);

      log.push(`Table "${tableName}": ${rawRecords.length} records`);

      if (rawRecords.length === 0) {
        throw new Error(`Table "${tableName}" has 0 records. Debug: ${log.join(' | ')}`);
      }

      // Step 4: detect field names
      const sampleFields = rawRecords[0].fields;
      const fieldKeys = Object.keys(sampleFields);
      log.push(`Fields: ${fieldKeys.join(', ')}`);

      // Find the name/company field
      const nameKey = (() => {
        const candidates = ['Name', 'name', 'Company', 'company', 'Client', 'client', 'Brand', 'brand', 'Account', 'account', 'Deal', 'deal', 'Title', 'title'];
        for (const c of candidates) {
          if (c in sampleFields) return c;
        }
        return fieldKeys[0] || 'Name';
      })();
      log.push(`Using "${nameKey}" as name field`);

      // Step 5: import records
      const existingCompanies = new Set(clients.map(c => c.company.toLowerCase()));
      let imported = 0;
      let skipped = 0;

      for (const rec of rawRecords) {
        const fields = rec.fields;
        const rawName = String(fields[nameKey] ?? '').trim();
        if (!rawName) continue;

        if (existingCompanies.has(rawName.toLowerCase())) { skipped++; continue; }

        const rawAmount = fields['$ Amount'] ?? fields['Amount'] ?? 0;
        const value = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[$,]/g, '')) || 0;

        const rawProb = fields['Probability'] ?? '10%';
        const probNum = parseFloat(String(rawProb).replace('%', '')) || 10;

        const rawDate = fields['Last touchpoint'] ?? '';
        let lastContact = today();
        if (rawDate) {
          const d = new Date(String(rawDate));
          if (!isNaN(d.getTime())) lastContact = d.toISOString().split('T')[0];
        }

        const nextScheduled = fields['Next Scheduled'] ?? fields['Next Scheduled Meeting'] ?? '';
        const notes = nextScheduled ? `Next scheduled: ${nextScheduled}` : '';

        addClient({
          name: '',
          company: rawName,
          email: '',
          phone: '',
          value,
          stage: probabilityToStage(probNum),
          notes,
          lastContact,
          tags: ['airtable-import'],
          proposals: [],
          industry: '',
          outcome: 'active',
          lostReason: '',
          stageHistory: [{ stage: probabilityToStage(probNum), date: lastContact }],
        });

        existingCompanies.add(rawName.toLowerCase());
        imported++;
      }

      setAirtableResult(`Imported ${imported}, skipped ${skipped} of ${rawRecords.length} records (table: "${tableName}", name field: "${nameKey}"). ${fieldKeys.length > 0 ? 'Fields: ' + fieldKeys.join(', ') : ''}`);
    } catch (err) {
      setAirtableError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setAirtableImporting(false);
    }
  };

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
          <div className="inline-block bg-[#7C3AED] px-4 py-2">
            <span className="font-sans font-bold text-white text-xl tracking-[0.15em] uppercase">KALEIDOSCOPE</span>
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
          <>
          {/* Airtable Import Panel */}
          <div className="max-w-7xl mx-auto px-6 pt-4">
            {!showAirtableImport ? (
              <button
                onClick={() => setShowAirtableImport(true)}
                className="text-xs text-brand-dark/30 hover:text-brand-dark/60 transition-colors"
              >
                Import from Airtable
              </button>
            ) : (
              <div className="bg-white border border-brand-cream rounded-xl p-4 mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">Import from Airtable</h3>
                  <button onClick={() => { setShowAirtableImport(false); setAirtableError(''); setAirtableResult(''); }} className="text-xs text-brand-dark/30 hover:text-brand-dark/60">Close</button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-brand-light border border-brand-cream rounded-lg text-xs font-mono text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                    value={airtableToken}
                    onChange={e => setAirtableToken(e.target.value)}
                    placeholder="pat... Airtable Personal Access Token"
                  />
                </div>
                <p className="text-xs text-brand-dark/40">Generate at airtable.com/create/tokens — add <strong>data.records:read</strong> + <strong>schema.bases:read</strong> scopes, and grant access to the K-Scope base.</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAirtableImport}
                    disabled={airtableImporting}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {airtableImporting ? 'Importing…' : 'Import Deals'}
                  </button>
                  {airtableResult && <span className="text-xs text-emerald-600 font-medium">{airtableResult}</span>}
                  {clients.some(c => c.tags?.includes('airtable-import')) && (
                    <button
                      onClick={() => {
                        const toRemove = clients.filter(c => c.tags?.includes('airtable-import'));
                        toRemove.forEach(c => deleteClient(c.id));
                        setAirtableResult(`Cleared ${toRemove.length} imported records.`);
                      }}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all"
                    >
                      Clear imported ({clients.filter(c => c.tags?.includes('airtable-import')).length})
                    </button>
                  )}
                </div>
                {airtableError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-700">{airtableError}</p>
                  </div>
                )}
              </div>
            )}
          </div>
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
          </>
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
        {view === 'bd' && (
          <Leads onAddToEngaged={handleAddProspectToEngaged} />
        )}
        {view === 'roadmap' && (
          <Roadmap companyName={companyName} />
        )}
        {view === 'analytics' && (
          <AnalyticsView clients={clients} companyName={companyName} />
        )}
      </main>
      <footer className="no-print bg-white border-t border-brand-cream px-6 py-2 flex items-center justify-between">
        <p className="text-xs text-brand-dark/35 font-medium">
          CONFIDENTIAL — Property of Kaleidoscope. Strictly private and confidential.
        </p>
        <div className="flex items-center gap-4">
          <p className="text-xs text-brand-dark/25">© {new Date().getFullYear()} Kaleidoscope</p>
          <button onClick={() => signOut()} className="text-xs text-brand-dark/25 hover:text-brand-dark/50 transition-colors">
            Sign out
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
