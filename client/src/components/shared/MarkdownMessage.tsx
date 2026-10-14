import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { CSSProperties, ReactNode } from 'react';

interface MarkdownMessageProps {
  children: string;
  style?: CSSProperties;
}

// Renders assistant chat replies with GitHub-flavored Markdown + LaTeX math
// via KaTeX. Inline math uses $…$ and block math uses $$…$$ (set by
// remark-math). Styling leans on the existing CSS variables so it inherits
// the chat bubble's color and sizing instead of KaTeX's defaults.
export default function MarkdownMessage({ children, style }: MarkdownMessageProps) {
  return (
    <div
      className="markdown-message"
      style={{
        fontSize: 14,
        lineHeight: 1.7,
        color: 'var(--text-primary)',
        wordBreak: 'break-word',
        ...style,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children: c }) => <p style={{ margin: '0 0 10px 0' }}>{c}</p>,
          ul: ({ children: c }) => (
            <ul style={{ margin: '0 0 10px 0', paddingLeft: 20 }}>{c}</ul>
          ),
          ol: ({ children: c }) => (
            <ol style={{ margin: '0 0 10px 0', paddingLeft: 20 }}>{c}</ol>
          ),
          li: ({ children: c }) => <li style={{ marginBottom: 4 }}>{c}</li>,
          h1: ({ children: c }) => (
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 6px' }}>{c}</h3>
          ),
          h2: ({ children: c }) => (
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 6px' }}>{c}</h4>
          ),
          h3: ({ children: c }) => (
            <h5 style={{ fontSize: 14, fontWeight: 700, margin: '6px 0 4px' }}>{c}</h5>
          ),
          strong: ({ children: c }) => (
            <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c}</strong>
          ),
          em: ({ children: c }) => <em style={{ fontStyle: 'italic' }}>{c}</em>,
          a: ({ children: c, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}
            >
              {c}
            </a>
          ),
          code: ({ className, children: c }: { className?: string; children?: ReactNode }) => {
            const isBlock = /language-/.test(className || '');
            if (isBlock) {
              return (
                <pre
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    overflowX: 'auto',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    margin: '6px 0 10px',
                  }}
                >
                  <code>{c}</code>
                </pre>
              );
            }
            return (
              <code
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  fontSize: '0.9em',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {c}
              </code>
            );
          },
          blockquote: ({ children: c }) => (
            <blockquote
              style={{
                borderLeft: '3px solid rgba(59,130,246,0.4)',
                margin: '6px 0 10px',
                padding: '2px 0 2px 12px',
                color: 'var(--text-secondary, var(--text-primary))',
                opacity: 0.9,
              }}
            >
              {c}
            </blockquote>
          ),
          table: ({ children: c }) => (
            <div style={{ overflowX: 'auto', margin: '6px 0 10px' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  fontSize: 13,
                }}
              >
                {c}
              </table>
            </div>
          ),
          th: ({ children: c }) => (
            <th
              style={{
                borderBottom: '1px solid var(--card-border)',
                padding: '6px 8px',
                textAlign: 'left',
                fontWeight: 600,
              }}
            >
              {c}
            </th>
          ),
          td: ({ children: c }) => (
            <td
              style={{
                borderBottom: '1px solid var(--card-border)',
                padding: '6px 8px',
              }}
            >
              {c}
            </td>
          ),
          hr: () => (
            <hr
              style={{
                border: 'none',
                borderTop: '1px solid var(--card-border)',
                margin: '10px 0',
              }}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
