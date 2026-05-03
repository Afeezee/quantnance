import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import { Paperclip, Send, X, FileText, Image as ImageIcon, Sheet } from 'lucide-react';
import BrandMark from '../shared/BrandMark';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  fileName?: string;
  fileType?: 'image' | 'pdf' | 'csv' | 'xlsx' | 'other';
  filePreview?: string; // base64 for images, null for others
}

const STARTER_PROMPTS = [
  'Explain what a P/E ratio means',
  'Compare crypto vs stocks for a Nigerian investor',
  'What are the risks of investing in emerging markets',
  'Analyse this financial document',
];

const ACCEPTED_FILE_TYPES = '.pdf,.csv,.xlsx,.xls';

function getFileType(file: File): ChatMessage['fileType'] {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/.test(name)) return 'image';
  if (name.endsWith('.pdf') || file.type.includes('pdf')) return 'pdf';
  if (name.endsWith('.csv') || file.type.includes('csv')) return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || file.type.includes('spreadsheet') || file.type.includes('excel')) return 'xlsx';
  return 'other';
}

function FileIcon({ type }: { type: ChatMessage['fileType'] }) {
  switch (type) {
    case 'image': return <ImageIcon size={14} />;
    case 'pdf': return <FileText size={14} />;
    case 'csv': return <Sheet size={14} />;
    case 'xlsx': return <Sheet size={14} />;
    default: return <FileText size={14} />;
  }
}

interface ResearchChatProps {
  initialMessage?: string;
  initialContext?: string;
}

export default function ResearchChat({ initialMessage, initialContext: _initialContext }: ResearchChatProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const initialHandled = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle initial message from search fallback
  useEffect(() => {
    if (initialMessage && !initialHandled.current) {
      initialHandled.current = true;
      void _initialContext;
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = Math.min(textAreaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);
    if (isImage) {
      alert('Only document uploads are supported in AI chat. Please upload PDF, CSV, XLSX, or XLS files.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10 MB.');
      return;
    }
    setAttachedFile(file);
    setFilePreviewUrl(null);
    // Reset input so re-selecting same file works
    e.target.value = '';
  };

  const removeFile = () => {
    setAttachedFile(null);
    setFilePreviewUrl(null);
  };

  const sendMessage = async (text: string, existingMessages?: ChatMessage[]) => {
    if ((!text.trim() && !attachedFile) || loading) return;

    const currentMessages = existingMessages ?? messages;
    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      fileName: attachedFile?.name,
      fileType: attachedFile ? getFileType(attachedFile) : undefined,
      filePreview: filePreviewUrl || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const formData = new FormData();
    formData.append('message', text.trim());
    formData.append('conversation_history', JSON.stringify(
      currentMessages.map((m) => ({ role: m.role, content: m.content }))
    ));
    if (attachedFile) {
      formData.append('file', attachedFile);
    }

    const currentFile = attachedFile;
    removeFile();

    try {
      let token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let resp;
      try {
        resp = await axios.post(`${API_URL}/api/research-chat`, formData, {
          headers,
          timeout: 60000,
        });
      } catch (err: unknown) {
        // Retry once with a fresh token on 401
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          token = await getToken({ skipCache: true });
          if (token) headers['Authorization'] = `Bearer ${token}`;
          resp = await axios.post(`${API_URL}/api/research-chat`, formData, {
            headers,
            timeout: 60000,
          });
        } else {
          throw err;
        }
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: resp.data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
      void currentFile;
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const showStarters = messages.length === 0 && !initialMessage;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        maxWidth: 860,
        margin: '0 auto',
        padding: '0 16px',
      }}
    >
      {/* Header */}
      <div
        className="animate-fade-in-up"
        style={{
          padding: '24px 0 16px',
          borderBottom: '1px solid var(--card-border)',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={40} alt="Quantnance AI" />
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              AI Research Assistant
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Ask about markets, financial concepts, or upload documents for analysis
            </p>
          </div>
        </div>
      </div>

      {/* Message area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingBottom: 16,
        }}
      >
        {/* Starter prompts */}
        {showStarters && (
          <div
            className="animate-fade-in-up"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 24,
              padding: '40px 0',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                What would you like to research?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Ask any financial question or upload a document for analysis
              </p>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
                width: '100%',
                maxWidth: 560,
              }}
            >
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="glass-card"
                  style={{
                    padding: '14px 18px',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    lineHeight: 1.5,
                    border: '1px solid var(--card-border)',
                    background: 'var(--card-bg)',
                    borderRadius: 12,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-hover-border)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <div
            key={i}
            className="animate-fade-in-up"
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 10,
            }}
          >
            {m.role === 'assistant' && (
              <BrandMark size={32} alt="Quantnance AI" style={{ marginTop: 2 }} />
            )}
            <div
              style={{
                maxWidth: '75%',
                padding: '12px 18px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${m.role === 'user' ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* File attachment chip */}
              {m.fileName && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    fontSize: 12,
                    color: 'var(--accent-blue)',
                    marginBottom: 8,
                  }}
                >
                  <FileIcon type={m.fileType} />
                  <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.fileName}
                  </span>
                </div>
              )}
              {/* Image preview */}
              {m.filePreview && m.fileType === 'image' && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={m.filePreview}
                    alt="Uploaded"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      borderRadius: 8,
                      border: '1px solid var(--card-border)',
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <BrandMark size={32} alt="Quantnance AI" />
            <div
              style={{
                padding: '14px 22px',
                borderRadius: '16px 16px 16px 4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: 5,
              }}
            >
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                    animation: `bounce-dot 1.2s ease-in-out ${n * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 0 20px',
          borderTop: '1px solid var(--card-border)',
        }}
      >
        {/* Attached file preview */}
        {attachedFile && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              marginBottom: 8,
              borderRadius: 10,
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.15)',
            }}
          >
            {filePreviewUrl ? (
              <img
                src={filePreviewUrl}
                alt="Preview"
                style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  background: 'rgba(59,130,246,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-blue)',
                }}
              >
                <FileIcon type={getFileType(attachedFile)} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {attachedFile.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {(attachedFile.size / 1024).toFixed(1)} KB
              </div>
            </div>
            <button
              onClick={removeFile}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: '50%',
                display: 'flex',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--card-border)',
              borderRadius: 10,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)';
              (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={textAreaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about markets, financial concepts, or upload a document..."
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              background: 'var(--input-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--input-border)',
              borderRadius: 12,
              color: 'var(--text-primary)',
              padding: '12px 16px',
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.5,
              maxHeight: 120,
              transition: 'border-color 0.3s ease',
            }}
            onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--input-focus-border)'; }}
            onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--input-border)'; }}
          />

          <button
            type="submit"
            disabled={loading || (!input.trim() && !attachedFile)}
            style={{
              background: 'var(--accent-blue)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              padding: '10px 14px',
              cursor: loading || (!input.trim() && !attachedFile) ? 'not-allowed' : 'pointer',
              opacity: loading || (!input.trim() && !attachedFile) ? 0.5 : 1,
              transition: 'opacity 0.2s, filter 0.2s',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              if (!loading && (input.trim() || attachedFile))
                (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)';
            }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'; }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
