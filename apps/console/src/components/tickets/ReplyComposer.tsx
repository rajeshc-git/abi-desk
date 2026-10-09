import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Lock,
  Globe,
  Paperclip,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Plus,
  ExternalLink,
  AtSign,
  Search,
} from 'lucide-react';
import { TicketsApi } from '../../api/tickets';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  SnippetTemplate,
  TicketSnippetContext,
  getAllSnippets,
  resolveSnippetPlaceholders,
} from './snippets';
import { SnippetModal } from './SnippetModal';

interface ReplyComposerProps {
  onSend: (
    body: string,
    isInternal: boolean,
    attachments?: string[],
    cc?: string[],
  ) => Promise<void>;
  isSending?: boolean;
  canWriteInternal?: boolean;
  ticket?: TicketSnippetContext;
  onClose?: () => void;
  initialIsInternal?: boolean;
  initialCc?: string[];
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  onSend,
  isSending = false,
  canWriteInternal = true,
  ticket,
  onClose,
  initialIsInternal = false,
  initialCc,
}) => {
  const { user } = useAuth();
  const [isMinimized, setIsMinimized] = useState(false);
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(initialIsInternal);

  useEffect(() => {
    setIsInternal(initialIsInternal);
  }, [initialIsInternal]);

  // Auto-focus textarea when composer opens
  useEffect(() => {
    if (!isMinimized && textareaRef.current) {
      // Small timeout to allow render/animation to settle
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isMinimized]);
  const [ccList, setCcList] = useState<string[]>(initialCc || []);
  const initialCcSet = useMemo(
    () => new Set((initialCc || []).map((e) => e.toLowerCase().trim())),
    [initialCc],
  );

  useEffect(() => {
    if (initialCc && initialCc.length > 0) {
      setCcList((prev) => (prev.length === 0 ? initialCc : prev));
    }
  }, [initialCc]);
  const [ccInput, setCcInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // @Mention Autocomplete state
  const [staffUsers, setStaffUsers] = useState<Array<{ id: string; fullName: string; email: string; role?: string; tier?: string }>>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number>(-1);

  // Fetch available team members for @mentions
  useEffect(() => {
    ApiClient.get<any[]>('/admin/users')
      .catch(() => ApiClient.get<any[]>('/users'))
      .then((res) => {
        if (Array.isArray(res)) {
          setStaffUsers(res.filter((u: any) => u.status !== 'DEACTIVATED'));
        }
      })
      .catch(() => {});
  }, []);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();
    return staffUsers
      .filter((u) => {
        const name = (u.fullName || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const emailPrefix = email.split('@')[0];
        return name.includes(q) || email.includes(q) || emailPrefix.includes(q);
      })
      .slice(0, 6);
  }, [mentionQuery, staffUsers]);

  const detectedMentions = useMemo(() => {
    if (!body || !body.includes('@')) return [];

    // Strip full valid email addresses first so typing contact@company.com or pasting snippets with emails never creates false @domain mentions
    const textWithoutEmails = body.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ');

    const list: string[] = [];
    // Must be preceded by start of line, whitespace, or punctuation, followed by @
    const matches = Array.from(textWithoutEmails.matchAll(/(?:^|[\s(\[{<])@([a-zA-Z0-9._-]+(?:\s[a-zA-Z0-9._-]+)?)/g));
    
    for (const m of matches) {
      const rawName = m[1].trim();
      if (!rawName) continue;

      // Validate against known staff users if available
      const matchedStaff = staffUsers.length > 0
        ? staffUsers.find((u) => {
            const fullName = (u.fullName || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const emailPrefix = email.split('@')[0];
            const q = rawName.toLowerCase();
            return fullName === q || email === q || emailPrefix === q;
          })
        : null;

      if (staffUsers.length > 0) {
        if (matchedStaff) {
          const displayLabel = matchedStaff.fullName || matchedStaff.email;
          if (!list.includes(displayLabel)) {
            list.push(displayLabel);
          }
        }
      } else if (!rawName.includes('.') && !list.includes(rawName)) {
        list.push(rawName);
      }
    }
    return list;
  }, [body, staffUsers]);

  const checkMentionTrigger = (text: string, cursor: number) => {
    const textBefore = text.slice(0, cursor);

    // Look for @ that is at start of string or preceded by whitespace / opening brackets
    // It must NOT be preceded by an alphanumeric character (e.g. "contact@" is an email, not a mention trigger)
    const match = textBefore.match(/(?:^|[\s(\[{<])@([a-zA-Z0-9._-]+(?:\s[a-zA-Z0-9._-]*)?)$/);
    if (match) {
      const query = match[1];
      // If user typed something that looks like an email domain (e.g. "gmail.com"), don't trigger mention autocomplete
      if (/\.[a-zA-Z]{2,}$/.test(query)) {
        setMentionQuery(null);
        return;
      }

      setMentionQuery(query);
      const atIndex = textBefore.lastIndexOf('@');
      setMentionStartPos(atIndex);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (targetUser: { fullName: string; email: string }) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStartPos < 0) return;

    const mentionTag = `@${targetUser.fullName || targetUser.email} `;
    const cursor = textarea.selectionStart ?? body.length;
    const before = body.substring(0, mentionStartPos);
    const after = body.substring(cursor);
    const newBody = `${before}${mentionTag}${after}`;

    setBody(newBody);
    setMentionQuery(null);

    setTimeout(() => {
      textarea.focus();
      const newPos = mentionStartPos + mentionTag.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 20);
  };

  const handleRemoveMention = (name: string) => {
    // Cleanly removes @Name (and optional trailing space) from composer body
    const regex = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?`, 'g');
    const newBody = body.replace(regex, '');
    setBody(newBody);
    setMentionQuery(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // If mention popover is actively open with navigation
    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Smart Atomic Backspace: If cursor is right after an @Mention tag, delete the whole tag in 1 press
    if (e.key === 'Backspace') {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        const cursor = textarea.selectionStart;
        const textBefore = body.slice(0, cursor);

        for (const staff of staffUsers) {
          const name = staff.fullName || staff.email;
          if (!name) continue;
          const tagWithSpace = `@${name} `;
          const tagWithoutSpace = `@${name}`;

          if (textBefore.endsWith(tagWithSpace)) {
            e.preventDefault();
            const newBody = body.slice(0, cursor - tagWithSpace.length) + body.slice(cursor);
            setBody(newBody);
            setMentionQuery(null);
            setTimeout(() => {
              textarea.focus();
              const newPos = cursor - tagWithSpace.length;
              textarea.setSelectionRange(newPos, newPos);
            }, 10);
            return;
          }

          if (textBefore.endsWith(tagWithoutSpace)) {
            e.preventDefault();
            const newBody = body.slice(0, cursor - tagWithoutSpace.length) + body.slice(cursor);
            setBody(newBody);
            setMentionQuery(null);
            setTimeout(() => {
              textarea.focus();
              const newPos = cursor - tagWithoutSpace.length;
              textarea.setSelectionRange(newPos, newPos);
            }, 10);
            return;
          }
        }
      }
    }
  };

  // Snippet dropdown & modal state
  const [isSnippetDropdownOpen, setIsSnippetDropdownOpen] = useState(false);
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [snippetModalCreateMode, setSnippetModalCreateMode] = useState(false);
  const snippetDropdownRef = useRef<HTMLDivElement>(null);

  // Quick list of available snippets
  const [quickSnippets, setQuickSnippets] = useState<SnippetTemplate[]>(() => getAllSnippets());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        snippetDropdownRef.current &&
        !snippetDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSnippetDropdownOpen(false);
      }
    };
    if (isSnippetDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSnippetDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setMentionQuery(null);
      }
    };
    if (mentionQuery !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mentionQuery]);

  const handleOpenSnippetsDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMinimized) setIsMinimized(false);
    setQuickSnippets(getAllSnippets());
    setIsSnippetDropdownOpen((prev) => !prev);
  };

  const handleApplySnippet = (snippetText: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;

      // If user specifically highlighted text, replace just that highlighted selection
      if (start !== end && body) {
        const before = body.substring(0, start);
        const after = body.substring(end);
        const newBody = `${before}${snippetText}${after}`;
        setBody(newBody);
      } else {
        // When choosing templates one after another, replace the previous template cleanly
        setBody(snippetText);
      }

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(snippetText.length, snippetText.length);
      }, 50);
    } else {
      setBody(snippetText);
    }
    setIsSnippetDropdownOpen(false);
  };

  const handleQuickInsert = (snippet: SnippetTemplate) => {
    const resolved = resolveSnippetPlaceholders(snippet.body, ticket, user?.fullName);
    handleApplySnippet(resolved);
  };

  const handleAddCc = (emailToAdd: string) => {
    const trimmed = emailToAdd.trim().toLowerCase().replace(/,/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmed && emailRegex.test(trimmed) && !ccList.includes(trimmed)) {
      setCcList([...ccList, trimmed]);
      setCcInput('');
    }
  };

  const handleCcKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      if (ccInput.trim()) {
        handleAddCc(ccInput);
      }
    } else if (e.key === 'Backspace' && !ccInput && ccList.length > 0) {
      const lastEmail = ccList[ccList.length - 1];
      if (lastEmail && !initialCcSet.has(lastEmail.toLowerCase())) {
        setCcList(ccList.slice(0, -1));
      }
    }
  };

  const removeCc = (emailToRemove: string) => {
    if (initialCcSet.has(emailToRemove.toLowerCase())) return;
    setCcList(ccList.filter((email) => email !== emailToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBody = body
      .replace(/<!--\s*StartFragment\s*(?:-->|→|>)?/gi, '')
      .replace(/<!--\s*EndFragment\s*(?:-->|→|>)?/gi, '')
      .replace(/<\/?(?:html|body)[^>]*>/gi, '')
      .trim();
    if (!cleanBody || isSending || isUploading) return;

    // Flush any pending text in ccInput
    const finalCcList = [...ccList];
    const pendingCc = ccInput.trim().toLowerCase().replace(/,/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (pendingCc && emailRegex.test(pendingCc) && !finalCcList.includes(pendingCc)) {
      finalCcList.push(pendingCc);
    }

    await onSend(
      cleanBody,
      isInternal && canWriteInternal,
      uploadedFiles.map((f) => f.id),
      !isInternal && finalCcList.length > 0 ? finalCcList : undefined,
    );
    setBody('');
    setUploadedFiles([]);
    setCcList([]);
    setCcInput('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newFiles = [...uploadedFiles];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const result = await TicketsApi.uploadFile(file);
        newFiles.push({ id: result.id, name: result.originalFilename });
      }
      setUploadedFiles(newFiles);
    } catch (err: any) {
      alert(`Failed to upload file: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={`reply-composer-card ${isMinimized ? 'is-minimized' : ''}`}>
        <div
          className="composer-toolbar"
          style={{ cursor: isMinimized ? 'pointer' : 'default', userSelect: 'none' }}
          onClick={() => {
            if (isMinimized) setIsMinimized(false);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canWriteInternal ? (
              <div className="composer-mode-tabs">
                <button
                  type="button"
                  className={`composer-tab ${!isInternal ? 'active public' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsInternal(false);
                    if (isMinimized) setIsMinimized(false);
                  }}
                >
                  <Globe size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Public Reply
                </button>
                <button
                  type="button"
                  className={`composer-tab ${isInternal ? 'active internal' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsInternal(true);
                    if (isMinimized) setIsMinimized(false);
                  }}
                >
                  <Lock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Internal Note
                </button>
              </div>
            ) : (
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Globe size={13} /> Public Reply
              </div>
            )}

            {/* Zoho Desk Style Snippet Template Button & Dropdown */}
            <div ref={snippetDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={handleOpenSnippetsDropdown}
                title="Insert Snippet Template (Zoho Desk style)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: isSnippetDropdownOpen
                    ? '1px solid var(--primary, #2563eb)'
                    : '1px solid var(--border-medium, #cbd5e1)',
                  backgroundColor: isSnippetDropdownOpen
                    ? 'var(--primary-surface, rgba(37, 99, 235, 0.12))'
                    : 'var(--bg-surface, #ffffff)',
                  color: isSnippetDropdownOpen
                    ? 'var(--primary, #2563eb)'
                    : 'var(--text-primary, #334155)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--primary, #2563eb)' }}
                  >
                    <path d="m12 19 7-7 3 3-7 7-3-3z" />
                    <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="m2 2 7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                  </svg>
                  <Sparkles
                    size={9}
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      color: '#f59e0b',
                    }}
                  />
                </div>
                <span>Snippet</span>
                <ChevronDown size={12} style={{ opacity: 0.7 }} />
              </button>

              {/* Zoho Desk Style Popover Dropdown */}
              {isSnippetDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: '300px',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0,0,0,0.06)',
                    zIndex: 9999,
                    padding: '6px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.12s ease-out',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Top Action: View All Snippets */}
                  <div
                    onClick={() => {
                      setIsSnippetDropdownOpen(false);
                      setSnippetModalCreateMode(false);
                      setIsSnippetModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary, #0f172a)',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={14} style={{ color: 'var(--primary, #2563eb)' }} />
                      <span>View All Snippets</span>
                    </div>
                    <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                  </div>

                  {/* Top Action: Add New Snippet */}
                  <div
                    onClick={() => {
                      setIsSnippetDropdownOpen(false);
                      setSnippetModalCreateMode(true);
                      setIsSnippetModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: 'var(--primary, #2563eb)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Plus size={14} />
                    <span>Add New Snippet</span>
                  </div>

                  {/* Section Label */}
                  <div
                    style={{
                      padding: '8px 14px 4px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted, #94a3b8)',
                    }}
                  >
                    Available Templates
                  </div>

                  {/* Quick Snippets List with smooth scrolling */}
                  <div
                    style={{
                      maxHeight: '240px',
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    {quickSnippets.map((snippet) => (
                      <div
                        key={snippet.id}
                        onClick={() => handleQuickInsert(snippet)}
                        style={{
                          padding: '7px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated, #f1f5f9)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span
                          title={snippet.name}
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '185px',
                            fontWeight: 500,
                          }}
                        >
                          {snippet.name}
                        </span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: snippet.isDefault ? 'rgba(100, 116, 139, 0.1)' : 'rgba(16, 185, 129, 0.12)',
                            color: snippet.isDefault ? '#64748b' : '#059669',
                            flexShrink: 0,
                          }}
                        >
                          {snippet.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isMinimized && body.trim().length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-surface, rgba(37,99,235,0.1))',
                  padding: '1px 8px',
                  borderRadius: '10px',
                  border: '1px solid var(--primary-border, rgba(37,99,235,0.2))',
                }}
              >
                Draft saved
              </span>
            )}
          </div>

          <div className="composer-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div
              className="composer-notice-text"
              title={
                isInternal && canWriteInternal
                  ? 'Internal note: visible to staff only'
                  : ccList.length > 0
                    ? `Public reply: Customer and ${ccList.length} CC recipient${ccList.length > 1 ? 's' : ''} will be notified via email`
                    : 'Public reply: Customer will be notified via email'
              }
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '220px',
                flexShrink: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {isInternal && canWriteInternal ? (
                <>
                  <Lock size={12} style={{ color: '#d97706', flexShrink: 0 }} />
                  <span>Staff only</span>
                </>
              ) : (
                <>
                  <Globe size={12} style={{ color: '#2563eb', flexShrink: 0 }} />
                  <span>{ccList.length > 0 ? `Customer + ${ccList.length} CC` : 'Customer'}</span>
                </>
              )}
            </div>

            {onClose ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="composer-collapse-btn"
                title="Close reply composer (Return to full conversation)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                className="composer-collapse-btn"
                title={isMinimized ? 'Expand reply box' : 'Minimize reply box'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>
        </div>

        <div className={`composer-body-collapsible ${isMinimized ? 'is-collapsed' : 'is-expanded'}`}>
          <div className="composer-body-collapsible-inner">
            {/* Integrated CC Bar for Public Replies */}
            {!isInternal && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '6px 16px',
                  backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', userSelect: 'none' }}>
                  CC:
                </span>

                {ccList.map((email) => {
                  const isCustomerProvided = initialCcSet.has(email.toLowerCase());
                  return (
                    <span
                      key={email}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: isCustomerProvided
                          ? 'rgba(37, 99, 235, 0.1)'
                          : 'rgba(16, 185, 129, 0.12)',
                        color: isCustomerProvided ? 'var(--primary, #2563eb)' : '#059669',
                        border: isCustomerProvided
                          ? '1px solid rgba(37, 99, 235, 0.25)'
                          : '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: isCustomerProvided ? '1px 8px' : '1px 6px 1px 8px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                      }}
                      title={isCustomerProvided ? 'Customer-provided CC recipient (Thread participant)' : 'Agent-added CC recipient'}
                    >
                      <span>{email}</span>
                      {!isCustomerProvided && (
                        <button
                          type="button"
                          onClick={() => removeCc(email)}
                          title="Remove CC"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 0,
                          }}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </span>
                  );
                })}

                <input
                  type="email"
                  placeholder={ccList.length === 0 ? 'Add CC email (press Enter or comma)...' : 'Add another CC...'}
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={handleCcKeyDown}
                  onBlur={() => {
                    if (ccInput.trim()) handleAddCc(ccInput);
                  }}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    padding: '2px 4px',
                  }}
                />
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  padding: '8px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                }}
              >
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px',
                      fontSize: '12px',
                    }}
                  >
                    <span>📎 {file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '14px',
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Live Mention Tags Bar */}
            {detectedMentions.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '5px 16px',
                  backgroundColor: 'rgba(37, 99, 235, 0.05)',
                  borderBottom: '1px solid rgba(37, 99, 235, 0.12)',
                  fontSize: '11px',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: 'var(--primary, #2563eb)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <AtSign size={12} />
                  <span>Mentioning:</span>
                </span>
                {detectedMentions.map((name) => (
                  <span
                    key={name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--primary, #2563eb)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: '12px',
                      padding: '1px 7px 1px 9px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    <span>@{name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMention(name)}
                      title={`Remove @${name}`}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--primary, #2563eb)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1px',
                        borderRadius: '50%',
                        opacity: 0.8,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ position: 'relative', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* WhatsApp/Slack-Style @Mention Autocomplete Popover */}
              {mentionQuery !== null && (
                <div
                  ref={mentionDropdownRef}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '14px',
                    width: '320px',
                    maxWidth: '90vw',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0,0,0,0.06)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.12s ease-out',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Popover Header with Search */}
                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AtSign size={13} style={{ color: 'var(--primary, #2563eb)' }} />
                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mention Teammate</span>
                      </div>
                      <span style={{ fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>
                        ↑↓ to navigate • ↵ to select
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        border: '1px solid var(--border-medium, #cbd5e1)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                      }}
                    >
                      <Search size={12} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Search team member..."
                        value={mentionQuery}
                        onChange={(e) => setMentionQuery(e.target.value)}
                        onKeyDown={handleTextareaKeyDown}
                        style={{
                          border: 'none',
                          outline: 'none',
                          fontSize: '12px',
                          width: '100%',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Mentions List */}
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredMentions.length === 0 ? (
                      <div style={{ padding: '14px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                        No staff members found matching "{mentionQuery}"
                      </div>
                    ) : (
                      filteredMentions.map((staff, idx) => {
                        const isSelected = idx === mentionIndex;
                        return (
                          <div
                            key={staff.id}
                            onClick={() => handleSelectMention(staff)}
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              cursor: 'pointer',
                              backgroundColor: isSelected
                                ? 'var(--primary-surface, rgba(37, 99, 235, 0.1))'
                                : 'transparent',
                              borderLeft: isSelected
                                ? '3px solid var(--primary, #2563eb)'
                                : '3px solid transparent',
                              transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={() => setMentionIndex(idx)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <div
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  backgroundColor: isSelected ? 'var(--primary, #2563eb)' : '#e2e8f0',
                                  color: isSelected ? '#ffffff' : '#334155',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {(staff.fullName || staff.email || '??').slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span
                                  style={{
                                    fontSize: '12.5px',
                                    fontWeight: isSelected ? 700 : 600,
                                    color: 'var(--text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {staff.fullName}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {staff.email}
                                </span>
                              </div>
                            </div>

                            {staff.role && (
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 600,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--bg-hover, #f1f5f9)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border-subtle)',
                                  flexShrink: 0,
                                }}
                              >
                                {staff.role}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="composer-textarea"
                placeholder={
                  isInternal && canWriteInternal
                    ? 'Write an internal note for teammates (type @ to mention a teammate)...'
                    : 'Type your reply to the customer (type @ to mention a teammate)...'
                }
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  checkMentionTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted && /<!--\s*(?:Start|End)Fragment/i.test(pasted)) {
                    e.preventDefault();
                    const cleaned = pasted
                      .replace(/<!--\s*StartFragment\s*(?:-->|→|>)?/gi, '')
                      .replace(/<!--\s*EndFragment\s*(?:-->|→|>)?/gi, '')
                      .replace(/<\/?(?:html|body)[^>]*>/gi, '');
                    document.execCommand('insertText', false, cleaned);
                  }
                }}
                onKeyDown={handleTextareaKeyDown}
                onClick={(e) => {
                  checkMentionTrigger(body, (e.target as HTMLTextAreaElement).selectionStart ?? body.length);
                }}
                onKeyUp={(e) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                    checkMentionTrigger(body, (e.target as HTMLTextAreaElement).selectionStart ?? body.length);
                  }
                }}
                style={{ flex: 1, minHeight: '180px', height: '100%', resize: 'none' }}
              />
            </div>

            {body.trim().length === 0 && (
              <div
                style={{
                  padding: '4px 16px 8px',
                  fontSize: '11px',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--bg-surface-elevated, #fff)',
                }}
              >
                <span>⚠️ Message text is required to submit a reply or note.</span>
              </div>
            )}

            <div className="composer-footer">
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Paperclip size={14} />
                  <span>{isUploading ? 'Uploading...' : 'Attach File'}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  style={{ display: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSending || isUploading || !body.trim()}
                className={`btn ${isInternal && canWriteInternal ? 'btn-secondary' : 'btn-primary'}`}
                style={{
                  ...(isInternal && canWriteInternal
                    ? { backgroundColor: '#f59e0b', color: '#ffffff', fontWeight: 600 }
                    : {}),
                  ...(isSending || isUploading || !body.trim()
                    ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }
                    : { cursor: 'pointer' }),
                }}
              >
                <Send size={14} />
                <span>
                  {isSending
                    ? 'Sending...'
                    : isInternal && canWriteInternal
                      ? 'Save Internal Note'
                      : 'Send Public Reply'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Snippet Manager Modal */}
      <SnippetModal
        isOpen={isSnippetModalOpen}
        onClose={() => setIsSnippetModalOpen(false)}
        onSelectSnippet={handleApplySnippet}
        ticket={ticket}
        currentUserName={user?.fullName}
        initialCreateMode={snippetModalCreateMode}
      />
    </>
  );
};
