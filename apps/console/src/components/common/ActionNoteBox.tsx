import React, { useRef, useEffect, useState } from 'react';
import { Bold, Type, ListOrdered, ChevronDown, RemoveFormatting } from 'lucide-react';

export function parseAndSanitizeNoteHtml(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  let content = raw.trim();
  if (!content) return '';

  // Check if string contains encoded HTML entity tags (e.g. &lt;h3, &lt;b, &lt;div, &lt;p, &lt;br, &lt;ol, &lt;li, &lt;strong)
  // or double-escaped entities and decode them
  while (/&lt;[a-z/!]/i.test(content) || /&amp;lt;/i.test(content)) {
    content = content
      .replace(/&amp;lt;/gi, '<')
      .replace(/&amp;gt;/gi, '>')
      .replace(/&amp;quot;/gi, '"')
      .replace(/&amp;#39;/gi, "'")
      .replace(/&amp;amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&');
  }

  // Convert markdown links [Text](url) to <a href="url" target="_blank" rel="noopener noreferrer">Text</a>
  content = content.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|[^\s)]+)\)/g, (_match, label, href) => {
    const safeHref = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')
      ? href
      : `https://${href}`;
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Convert markdown bold (**text** or __text__) to <b>
  content = content.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  content = content.replace(/__([^_]+)__/g, '<b>$1</b>');

  // Convert markdown headers
  content = content.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  content = content.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
  content = content.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');

  // If content has plain newlines and no HTML block/break tags, convert \n to <br>
  const hasHtml = /<(?:p|div|h[1-6]|br|ol|ul|li|b|strong|span|font|a)[^>]*>/i.test(content);
  if (!hasHtml) {
    content = content.replace(/\n/g, '<br>');
  }

  // Strip foreign inline styles that cause huge purple/highlighted pasted text, but keep <a> links clean
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined' && /<[a-z/]/i.test(content)) {
    try {
      const doc = new DOMParser().parseFromString(content, 'text/html');
      doc.body.querySelectorAll('*').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (tag === 'a') {
          const href = el.getAttribute('href') || el.textContent || '';
          const safeHref = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')
            ? href
            : `https://${href}`;
          el.setAttribute('href', safeHref);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
          el.removeAttribute('style');
          el.removeAttribute('class');
        } else if (tag === 'font') {
          if (el.getAttribute('size') !== '1') {
            el.removeAttribute('size');
          }
          el.removeAttribute('color');
          el.removeAttribute('style');
        } else {
          el.removeAttribute('style');
          el.removeAttribute('class');
        }
      });
      content = doc.body.innerHTML;
    } catch {
      // Fallback
    }
  }

  return content;
}

export interface ActionNoteViewerProps {
  content: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  maxHeight?: string;
}

export const ActionNoteViewer: React.FC<ActionNoteViewerProps> = ({
  content,
  className = '',
  style = {},
  maxHeight,
}) => {
  if (!content || !content.trim()) return null;

  const html = parseAndSanitizeNoteHtml(content);

  return (
    <>
      <style>{`
        .action-note-viewer h3, .org-description-content h3 {
          font-size: 12px;
          font-weight: 700;
          margin: 4px 0 1px 0;
          color: var(--text-primary, #0f172a);
          line-height: 1.35;
        }
        .action-note-viewer p, .org-description-content p {
          margin: 1.5px 0;
        }
        .action-note-viewer ol, .org-description-content ol {
          margin: 2px 0 2px 18px;
          padding: 0;
        }
        .action-note-viewer li, .org-description-content li {
          margin-bottom: 1px;
        }
        .action-note-viewer font[size="1"], .org-description-content font[size="1"] {
          font-size: 10px;
          color: var(--text-muted, #64748b);
        }
        .action-note-viewer b, .org-description-content b,
        .action-note-viewer strong, .org-description-content strong {
          font-weight: 700;
          color: var(--text-primary, #0f172a);
        }
        .action-note-viewer a, .org-description-content a {
          color: var(--primary, #2563eb);
          text-decoration: underline;
          font-size: inherit;
          font-weight: 500;
          word-break: break-all;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          transition: opacity 0.15s ease;
        }
        .action-note-viewer a::after, .org-description-content a::after {
          content: "↗";
          font-size: 10px;
          opacity: 0.7;
          text-decoration: none;
          display: inline-block;
          margin-left: 1px;
        }
        .action-note-viewer a:hover, .org-description-content a:hover {
          opacity: 0.8;
          color: #1d4ed8;
        }
      `}</style>
      <div
        className={`action-note-viewer ${className}`}
        style={{
          fontSize: '11px',
          lineHeight: '1.45',
          color: 'var(--text-secondary, #475569)',
          wordBreak: 'break-word',
          maxHeight: maxHeight || undefined,
          overflowY: maxHeight ? 'auto' : undefined,
          ...style,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
};

export interface ActionNoteBoxProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  minRows?: number;
  maxHeight?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  showToolbar?: boolean;
  accentColor?: string;
}

export const ActionNoteBox: React.FC<ActionNoteBoxProps> = ({
  value,
  onChange,
  placeholder = 'Write a note, numbered steps, or action details...',
  required = false,
  minRows = 3,
  maxHeight = '180px',
  autoFocus = false,
  disabled = false,
  showToolbar = true,
  accentColor = '#f59e0b',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [stats, setStats] = useState({ words: 0, chars: 0 });

  const updateStats = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
    const words = cleanText ? cleanText.split(/\s+/).length : 0;
    const chars = text.length;
    setStats({ words, chars });
  };

  // Synchronize incoming value when changed from outside
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      const currentHtml = editorRef.current.innerHTML;
      const targetVal = parseAndSanitizeNoteHtml(value || '');

      if (currentHtml !== targetVal) {
        editorRef.current.innerHTML = targetVal;
        updateStats();
      }
    }
    isInternalUpdate.current = false;
  }, [value]);

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  const handleInput = () => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    const text = editorRef.current.innerText || '';
    const html = editorRef.current.innerHTML;

    const isEmpty = text.trim() === '' && !html.includes('<img');
    const finalVal = isEmpty ? '' : html;
    onChange(finalVal);
    updateStats();
  };

  const executeCommand = (cmd: string, val: string | undefined = undefined) => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const setBlockFormat = (tag: 'h3' | 'p' | 'small') => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();

    if (tag === 'small') {
      document.execCommand('fontSize', false, '1');
    } else if (tag === 'h3') {
      document.execCommand('formatBlock', false, '<h3>');
    } else {
      document.execCommand('formatBlock', false, '<p>');
    }
    setIsSizeMenuOpen(false);
    handleInput();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain') || '';
    const html = e.clipboardData.getData('text/html') || '';

    const sanitized = parseAndSanitizeNoteHtml(html || text);
    if (sanitized) {
      document.execCommand('insertHTML', false, sanitized);
      handleInput();
    }
  };

  const convertToPlainText = () => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();

    // Extract pure text without any HTML tags or styles
    const rawText = editorRef.current.innerText || '';
    if (!rawText.trim()) return;

    // Convert raw text lines into clean, unstyled paragraphs
    const lines = rawText.split(/\r?\n/);
    const plainHtml = lines
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return escaped.trim() ? `<p>${escaped}</p>` : '<p><br></p>';
      })
      .join('');

    editorRef.current.innerHTML = plainHtml;
    isInternalUpdate.current = true;
    onChange(plainHtml);
    updateStats();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '10px',
        border: '1px solid var(--border-medium, #cbd5e1)',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), inset 0 1px 2px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = accentColor;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}18, inset 0 1px 2px rgba(0,0,0,0.02)`;
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-medium, #cbd5e1)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), inset 0 1px 2px rgba(0,0,0,0.02)';
      }}
    >
      {/* Streamlined Visual Toolbar: Bold, Size, Numbered List, Char Count */}
      {showToolbar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            backgroundColor: 'var(--bg-app, #f8fafc)',
            borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
            fontSize: '11.5px',
            userSelect: 'none',
          }}
        >
          {/* Tools: Bold, Size, Numbered List */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {/* Bold */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => executeCommand('bold')}
              title="Bold"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #334155)',
                padding: '4px 7px',
                borderRadius: '5px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '12px',
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.color = accentColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #334155)';
                }
              }}
            >
              <Bold size={13} />
              <span>Bold</span>
            </button>

            {/* Size Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
                title="Line Text Size"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary, #334155)',
                  padding: '4px 7px',
                  borderRadius: '5px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!disabled) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Type size={13} />
                <span>Size</span>
                <ChevronDown size={11} style={{ opacity: 0.7 }} />
              </button>

              {isSizeMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
                    zIndex: 50,
                    minWidth: '130px',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setBlockFormat('h3')}
                    style={{
                      padding: '5px 8px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-app, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    Large (Heading)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockFormat('p')}
                    style={{
                      padding: '5px 8px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-app, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    Normal (Body)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockFormat('small')}
                    style={{
                      padding: '5px 8px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-app, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    Small (Subtext)
                  </button>
                </div>
              )}
            </div>

            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-medium, #e2e8f0)', margin: '0 2px' }} />

            {/* Numbered List */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => executeCommand('insertOrderedList')}
              title="Numbered List (1. 2. 3.)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #475569)',
                padding: '4px 7px',
                borderRadius: '5px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.color = accentColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #475569)';
                }
              }}
            >
              <ListOrdered size={13} />
              <span>Numbered</span>
            </button>

            {/* Plain Text / Strip Formatting */}
            <button
              type="button"
              disabled={disabled}
              onClick={convertToPlainText}
              title="Make into Plain Text (Strip all formatting and styling)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #475569)',
                padding: '4px 7px',
                borderRadius: '5px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.color = accentColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #475569)';
                }
              }}
            >
              <RemoveFormatting size={13} />
              <span>Plain Text</span>
            </button>
          </div>

          {/* Word & Character Count on the Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted, #94a3b8)', fontSize: '11px' }}>
            <span>
              {stats.words} {stats.words === 1 ? 'word' : 'words'} · {stats.chars} chars
            </span>
          </div>
        </div>
      )}

      {/* Rich Visual WYSIWYG Editor Area */}
      <style>{`
        .action-note-editor:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted, #94a3b8);
          pointer-events: none;
          display: block;
        }
        .action-note-editor h3 {
          font-size: 15px;
          font-weight: 700;
          margin: 4px 0 2px 0;
          color: var(--text-primary);
        }
        .action-note-editor p {
          margin: 2px 0;
        }
        .action-note-editor ol {
          margin: 4px 0 4px 20px;
          padding: 0;
        }
        .action-note-editor li {
          margin-bottom: 2px;
        }
        .action-note-editor font[size="1"] {
          font-size: 11.5px;
          color: var(--text-muted, #64748b);
        }
        .action-note-editor::-webkit-scrollbar {
          width: 6px;
        }
        .action-note-editor::-webkit-scrollbar-track {
          background: transparent;
        }
        .action-note-editor::-webkit-scrollbar-thumb {
          background: var(--border-medium, #cbd5e1);
          border-radius: 4px;
        }
        .action-note-editor::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted, #94a3b8);
        }
      `}</style>

      <div
        ref={editorRef}
        className="action-note-editor"
        contentEditable={!disabled}
        data-placeholder={placeholder}
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={handlePaste}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 14px',
          backgroundColor: 'transparent',
          color: 'var(--text-primary, #0f172a)',
          fontSize: '13.5px',
          lineHeight: '1.6',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minHeight: `${minRows * 24 + 30}px`,
          maxHeight,
          outline: 'none',
          overflowY: 'auto',
          resize: 'vertical',
        }}
      />
    </div>
  );
};
