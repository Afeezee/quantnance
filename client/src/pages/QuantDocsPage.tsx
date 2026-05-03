import { useMemo, useRef, useState, useEffect, type ChangeEvent, type DragEvent } from 'react';
import axios from 'axios';
import { SignedIn, useAuth } from '@clerk/clerk-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  FileSpreadsheet,
  FileSearch,
  Upload,
  Printer,
  RotateCcw,
  Sparkles,
  Clock,
  Trash2,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import Background from '../components/layout/Background';
import Navbar from '../components/layout/Navbar';
import GlassCard from '../components/shared/GlassCard';
import LoadingProgress, { type LoadingStep } from '../components/shared/LoadingProgress';
import ChatInterface from '../components/brief/ChatInterface';
import BrandMark from '../components/shared/BrandMark';
import { useSearchHistory, type HistoryEntry } from '../hooks/useSearchHistory';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const EXAMPLE_PROMPTS = [
  'Assess this for investment risk',
  'Extract the key financial metrics',
  'Is this company financially healthy?',
];

const QUANTDOCS_LOADING_STEPS: LoadingStep[] = [
  { label: 'Extracting document content', detail: 'Reading pages, sheets, rows and financial line items', duration: 3500 },
  { label: 'Normalising financial structure', detail: 'Organising raw figures into comparable metric groups', duration: 3500 },
  { label: 'Running QuantDocs analysis', detail: 'Scoring financial health, risk flags and opportunities', duration: 6500 },
  { label: 'Building dashboard output', detail: 'Preparing summary cards, charts and investor Q&A context', duration: 4000 },
];

interface ExtractedMetric {
  label: string;
  value: string;
  unit: string;
}

interface RadarScores {
  'Revenue Growth': number;
  'Gross Margin': number;
  Profitability: number;
  Liquidity: number;
  'Debt Level': number;
  'Operational Efficiency': number;
}

interface QuantDocsAnalysis {
  document_type: string;
  company_name: string;
  period_covered: string;
  overview: string;
  quant_score: number;
  radar_scores: RadarScores;
  extracted_metrics: ExtractedMetric[];
  risk_flags: string[];
  opportunity_signals: string[];
  ai_verdict: string;
  suggested_questions: string[];
  analysis_mode?: 'ai' | 'rule_based';
  warning?: string;
}

interface QuantDocsResponse {
  ok: boolean;
  error?: string;
  analysis?: QuantDocsAnalysis;
  document_context?: Record<string, unknown>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileKind(file: File | null): 'PDF' | 'Excel' | 'CSV' | 'Unknown' {
  if (!file) return 'Unknown';
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'Excel';
  if (lower.endsWith('.csv')) return 'CSV';
  return 'Unknown';
}

function getFileIcon(file: File | null) {
  const kind = getFileKind(file);
  if (kind === 'PDF') return <FileText size={18} />;
  if (kind === 'Excel') return <FileSpreadsheet size={18} />;
  if (kind === 'CSV') return <FileText size={18} />;
  return <FileSearch size={18} />;
}

function AnimatedQuantScore({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  const clamped = Math.max(0, Math.min(100, score));

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 1500;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(clamped * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
      <svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label={`Quant score ${displayScore} out of 100`}>
        <circle cx="85" cy="85" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle
          cx="85"
          cy="85"
          r={radius}
          fill="none"
          stroke="url(#quantScoreGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 85 85)"
          style={{ transition: 'stroke-dashoffset 100ms linear' }}
        />
        <defs>
          <linearGradient id="quantScoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-blue)" />
            <stop offset="100%" stopColor="var(--accent-teal)" />
          </linearGradient>
        </defs>
        <text x="85" y="78" textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 12 }}>
          Quant Score
        </text>
        <text x="85" y="102" textAnchor="middle" style={{ fill: 'var(--text-primary)', fontSize: 30, fontWeight: 700 }}>
          {displayScore}
        </text>
        <text x="85" y="118" textAnchor="middle" style={{ fill: 'var(--text-secondary)', fontSize: 11 }}>
          /100
        </text>
      </svg>
    </div>
  );
}

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function QuantDocsSidebar({
  open,
  history,
  loading,
  loadingMore,
  hasMore,
  pendingDeleteIds,
  onSelect,
  onDelete,
  onLoadMore,
  onClose,
}: {
  open: boolean;
  history: HistoryEntry[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  pendingDeleteIds: ReadonlySet<string>;
  onSelect: (prompt: string, mode: string) => void;
  onDelete: (entryId: string) => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of history) map[entry.id] = formatTimeLabel(entry.timestamp);
    return map;
  }, [history]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return history;
    const q = filter.toLowerCase();
    return history.filter((e) => (e.displayPrompt ?? e.prompt).toLowerCase().includes(q));
  }, [history, filter]);

  const modeLabel = (mode: string) => {
    switch (mode) {
      case 'quantdocs': return { icon: '📄', text: 'QuantDocs' };
      case 'research': return { icon: '💬', text: 'AI Research' };
      case 'compare': return { icon: '⇄', text: 'Compare' };
      case 'recommend': return { icon: '★', text: 'Recommend' };
      default: return { icon: '◎', text: 'Analyze' };
    }
  };

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      )}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 320, zIndex: 70,
        background: 'var(--card-bg-solid)', borderRight: '1px solid var(--card-border)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={32} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Quantnance <span style={{ color: 'var(--accent-blue)', fontStyle: 'italic' }}>AI</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>History</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}><X size={18} /></button>
        </div>
        {history.length > 0 && (
          <div style={{ padding: '12px 16px 0' }}>
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search history..."
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }}
            />
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>No history yet.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}><p>No matches found.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((entry) => {
                const { icon, text } = modeLabel(entry.mode);
                return (
                  <div key={entry.id} className="history-item" onClick={() => { onSelect(entry.prompt, entry.mode); onClose(); }}>
                    <span style={{ fontSize: 14, opacity: 0.6, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-primary)' }}>{entry.displayPrompt ?? entry.prompt}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{text} · {labels[entry.id] ?? ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <ArrowRight size={12} style={{ opacity: 0.3 }} />
                      <button
                        type="button"
                        aria-label="Delete history entry"
                        disabled={pendingDeleteIds.has(entry.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onDelete(entry.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: pendingDeleteIds.has(entry.id) ? 'default' : 'pointer', padding: 4, borderRadius: 6, display: 'flex', opacity: pendingDeleteIds.has(entry.id) ? 0.4 : 0.7 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!filter.trim() && hasMore && (
                <button
                  type="button"
                  onClick={() => { void onLoadMore(); }}
                  disabled={loadingMore}
                  style={{ marginTop: 10, background: 'none', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: loadingMore ? 'default' : 'pointer', fontSize: 12, padding: '8px 10px' }}
                >
                  {loadingMore ? 'Loading...' : 'Load older history'}
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default function QuantDocsPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const { history, loading: historyLoading, loadingMore, hasMore, pendingDeleteIds, addEntry, deleteEntry, loadMore } = useSearchHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastHistoryKeyRef = useRef('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuantDocsAnalysis | null>(null);
  const [documentContext, setDocumentContext] = useState<Record<string, unknown> | null>(null);

  const radarData = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.radar_scores).map(([axis, value]) => ({ axis, value }));
  }, [result]);

  useEffect(() => {
    const q = searchParams.get('question');
    if (q && !result) {
      setQuestion(q);
    }
  }, [searchParams, result]);

  useEffect(() => {
    if (!result || !selectedFile) return;

    const prompt = question.trim();
    const displayPrompt = prompt
      ? `${selectedFile.name} · ${prompt}`
      : `${selectedFile.name} · Document analysis`;
    const historyKey = `${selectedFile.name}:${prompt}:${result.quant_score}:${result.company_name}`;

    if (lastHistoryKeyRef.current === historyKey) return;
    lastHistoryKeyRef.current = historyKey;
    void addEntry(prompt, 'quantdocs', displayPrompt);
  }, [addEntry, question, result, selectedFile]);

  const handleHistorySelect = (prompt: string, historyMode: string) => {
    if (historyMode === 'quantdocs') {
      navigate(prompt.trim() ? `/quantdocs?question=${encodeURIComponent(prompt)}` : '/quantdocs');
      return;
    }
    if (historyMode === 'research') {
      navigate(`/research?q=${encodeURIComponent(prompt)}`);
      return;
    }
    navigate(`/?prompt=${encodeURIComponent(prompt)}`);
  };

  const handlePick = (file: File | null) => {
    setError(null);
    if (!file) return;
    const lower = file.name.toLowerCase();
    const allowed = lower.endsWith('.pdf') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
    if (!allowed) {
      setError('Unsupported file type. Please upload PDF, XLSX, XLS, or CSV.');
      return;
    }
    setSelectedFile(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    handlePick(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handlePick(file);
  };

  const analyzeDocument = async () => {
    if (!selectedFile || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setDocumentContext(null);

    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('question', question.trim());

      const { data } = await axios.post<QuantDocsResponse>(`${API_URL}/api/quantdocs`, form, {
        headers,
        timeout: 120000,
      });

      if (!data.ok || !data.analysis) {
        setError(data.error ?? 'Could not analyse this document.');
        return;
      }

      setResult(data.analysis);
      setDocumentContext(data.document_context ?? null);
    } catch {
      setError('Could not analyse this document right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setQuestion('');
    setError(null);
    setResult(null);
    setDocumentContext(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <Background />
      <Navbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <SignedIn>
        <QuantDocsSidebar
          open={sidebarOpen}
          history={history}
          loading={historyLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          pendingDeleteIds={pendingDeleteIds}
          onSelect={handleHistorySelect}
          onDelete={deleteEntry}
          onLoadMore={loadMore}
          onClose={() => setSidebarOpen(false)}
        />
      </SignedIn>
      <main className="container">
        <section className="animate-fade-in-up" style={{ paddingTop: 28, paddingBottom: 48 }}>
          <h1 style={{ fontSize: 40, letterSpacing: '-0.02em', marginBottom: 8 }}>
            <span className="text-gradient">QuantDocs</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 760 }}>
            Upload annual reports, spreadsheets, and financial statements to generate an instant investor-grade analysis dashboard.
          </p>
        </section>

        {!result && !loading && (
          <section className="brief-layout">
            <GlassCard>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1px dashed ${dragActive ? 'var(--accent-teal)' : 'var(--card-border)'}`,
                  borderRadius: 16,
                  minHeight: 240,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: dragActive ? 'rgba(45, 212, 191, 0.08)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.25s ease',
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                <Upload size={28} style={{ color: 'var(--accent-teal)', marginBottom: 12 }} />
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Drop your financial document here</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>or click to browse from your computer</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={onInputChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> PDF</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileSpreadsheet size={14} /> XLSX/XLS</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileSearch size={14} /> CSV</span>
                <span>Accepted formats: PDF, XLSX, XLS, CSV</span>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EXAMPLE_PROMPTS.map((chip) => (
                    <button
                      key={chip}
                      className="search-chip"
                      onClick={() => setQuestion(chip)}
                      type="button"
                    >
                      <Sparkles size={13} />
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Optional context question for the analysis..."
                style={{
                  marginTop: 16,
                  width: '100%',
                  minHeight: 84,
                  resize: 'vertical',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: 12,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  padding: 12,
                  fontSize: 14,
                  outline: 'none',
                }}
              />

              {selectedFile && (
                <div style={{ marginTop: 16 }} className="metric-cell">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {getFileIcon(selectedFile)}
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{selectedFile.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {formatBytes(selectedFile.size)} · {getFileKind(selectedFile)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ marginTop: 14, color: 'var(--danger)', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={analyzeDocument}
                  disabled={!selectedFile || loading}
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))',
                    border: 'none',
                    borderRadius: 12,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '12px 20px',
                    cursor: !selectedFile || loading ? 'not-allowed' : 'pointer',
                    opacity: !selectedFile || loading ? 0.5 : 1,
                  }}
                >
                  {loading ? 'Analysing...' : 'Analyse'}
                </button>
              </div>
            </GlassCard>
          </section>
        )}

        {loading && !result && (
          <LoadingProgress
            title="Analysing document"
            subtitle={selectedFile ? `Preparing investor-grade analysis for ${selectedFile.name}` : 'Preparing investor-grade document analysis'}
            steps={QUANTDOCS_LOADING_STEPS}
            footerText="Document analysis may take 20–40s depending on file size and model availability"
            icon="📄"
          />
        )}

        {result && (
          <section className="brief-layout quantdocs-print-root">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }} className="quantdocs-actions no-print">
              <button
                onClick={() => window.print()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 10,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                <Printer size={14} /> Export PDF
              </button>
              <button
                onClick={reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 10,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>

            {result.warning && (
              <GlassCard>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(245,158,11,0.15)',
                      color: 'var(--warning)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    !
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      QuantDocs used a fallback analysis path
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {result.warning}. The dashboard below is based on extracted document figures rather than the live LLM response.
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}

            <GlassCard title="Document Summary" icon={<span>📄</span>}>
              <div className="two-col-grid" style={{ gap: 12, marginBottom: 16 }}>
                <div className="metric-cell"><strong>Document Type:</strong> {result.document_type || 'Unknown'}</div>
                <div className="metric-cell"><strong>Company:</strong> {result.company_name || 'Unknown'}</div>
                <div className="metric-cell" style={{ gridColumn: '1 / -1' }}><strong>Period Covered:</strong> {result.period_covered || 'Unknown'}</div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8 }}>{result.overview}</p>
            </GlassCard>

            <GlassCard title="Quant Score" icon={<span>🎯</span>}>
              <AnimatedQuantScore score={result.quant_score} />
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--card-border)" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="var(--accent-teal)"
                      fill="var(--accent-teal)"
                      fillOpacity={0.35}
                      isAnimationActive={true}
                      animationDuration={1200}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard title="Extracted Key Metrics" icon={<span>📊</span>}>
              <div className="quantdocs-metrics-grid">
                {result.extracted_metrics.length === 0 && (
                  <div className="metric-cell">No structured metrics were extracted from this document.</div>
                )}
                {result.extracted_metrics.map((metric) => (
                  <div key={`${metric.label}-${metric.value}`} className="metric-cell">
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{metric.label}</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>
                      {metric.value} {metric.unit}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard title="Risk Flags and Opportunities" icon={<span>⚖️</span>}>
              <div className="two-col-grid">
                <div>
                  <h4 style={{ marginBottom: 10, color: 'var(--danger)', fontSize: 14 }}>Risk Flags</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.risk_flags.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No major risk flags identified.</span>}
                    {result.risk_flags.map((risk) => (
                      <span
                        key={risk}
                        style={{
                          background: 'rgba(248,113,113,0.15)',
                          color: 'var(--danger)',
                          borderRadius: 999,
                          padding: '6px 10px',
                          fontSize: 12,
                          border: '1px solid rgba(248,113,113,0.25)',
                        }}
                      >
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 style={{ marginBottom: 10, color: 'var(--success)', fontSize: 14 }}>Opportunity Signals</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.opportunity_signals.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No major opportunity signals identified.</span>}
                    {result.opportunity_signals.map((signal) => (
                      <span
                        key={signal}
                        style={{
                          background: 'rgba(52,211,153,0.15)',
                          color: 'var(--success)',
                          borderRadius: 999,
                          padding: '6px 10px',
                          fontSize: 12,
                          border: '1px solid rgba(52,211,153,0.25)',
                        }}
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard style={{ position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-violet))',
                }}
              />
              <div style={{ paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>✨</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    AI Verdict
                  </span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  {result.ai_verdict}
                </p>
              </div>
            </GlassCard>

            <ChatInterface
              mode="document"
              documentContext={documentContext}
              starterQuestions={result.suggested_questions}
              title="AI Q&A"
              inputPlaceholder="Ask a question about this uploaded document..."
            />
          </section>
        )}
      </main>
    </>
  );
}
