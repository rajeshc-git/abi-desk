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
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Table,
  Highlighter,
} from 'lucide-react';
import { TicketsApi } from '../../api/tickets';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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
  const toast = useToast();
  const [isMinimized, setIsMinimized] = useState(false);
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(initialIsInternal);

  useEffect(() => {
    setIsInternal(initialIsInternal);
  }, [initialIsInternal]);

  // Auto-focus editor when composer opens
  useEffect(() => {
    if (!isMinimized && editorRef.current) {
      // Small timeout to allow render/animation to settle
      const timer = setTimeout(() => {
        editorRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isMinimized]);
  const sanitizedInitialCc = useMemo(
    () =>
      (initialCc || []).filter(
        (e) => typeof e === 'string' && e.toLowerCase().trim() !== ticket?.requester?.email?.toLowerCase().trim(),
      ),
    [initialCc, ticket?.requester?.email],
  );

  const [ccList, setCcList] = useState<string[]>(sanitizedInitialCc);
  const initialCcSet = useMemo(
    () => new Set(sanitizedInitialCc.map((e) => e.toLowerCase().trim())),
    [sanitizedInitialCc],
  );

  useEffect(() => {
    if (sanitizedInitialCc && sanitizedInitialCc.length > 0) {
      setCcList((prev) => (prev.length === 0 ? sanitizedInitialCc : prev));
    }
  }, [sanitizedInitialCc]);
  const [ccInput, setCcInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ id: string; name: string; previewUrl?: string; isUploading?: boolean; sizeBytes?: number }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const savedMentionRangeRef = useRef<{ node: Node; atIdx: number; endOffset: number } | null>(null);

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
        savedMentionRangeRef.current = null;
        return;
      }

      setMentionQuery(query);
      const atIndex = textBefore.lastIndexOf('@');
      setMentionStartPos(atIndex);
      setMentionIndex(0);

      const sel = window.getSelection();
      if (sel && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
        savedMentionRangeRef.current = {
          node: sel.anchorNode,
          atIdx: atIndex,
          endOffset: sel.anchorOffset,
        };
      }
    } else {
      setMentionQuery(null);
      savedMentionRangeRef.current = null;
    }
  };

  const handleSelectMention = (targetUser: { fullName: string; email: string }) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const mentionTag = `@${targetUser.fullName || targetUser.email} `;

    let replaced = false;
    const saved = savedMentionRangeRef.current;

    if (saved && editor.contains(saved.node) && saved.node.nodeType === Node.TEXT_NODE) {
      const currentText = saved.node.textContent || '';
      if (saved.atIdx >= 0 && saved.atIdx < currentText.length) {
        const sel = window.getSelection();
        const range = document.createRange();
        const end = Math.min(Math.max(saved.endOffset, saved.atIdx + 1), currentText.length);
        range.setStart(saved.node, saved.atIdx);
        range.setEnd(saved.node, end);
        range.deleteContents();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        replaced = true;
      }
    }

    if (!replaced) {
      const sel = window.getSelection();
      if (sel && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
        const node = sel.anchorNode;
        const offset = sel.anchorOffset;
        const textBefore = node.textContent?.slice(0, offset) || '';
        const atIdx = textBefore.lastIndexOf('@');
        if (atIdx >= 0) {
          const range = document.createRange();
          range.setStart(node, atIdx);
          range.setEnd(node, offset);
          range.deleteContents();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }

    document.execCommand('insertText', false, mentionTag);
    savedMentionRangeRef.current = null;
    setBody(editor.innerHTML);
    setMentionQuery(null);
  };

  const handleRemoveMention = (name: string) => {
    // Cleanly removes @Name (and optional trailing space) from composer body
    const regex = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?`, 'g');
    const newBody = body.replace(regex, '');
    setBody(newBody);
    setMentionQuery(null);
    if (editorRef.current) {
      editorRef.current.innerHTML = newBody;
      editorRef.current.focus();
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
        editorRef.current &&
        !editorRef.current.contains(e.target as Node)
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
    const editor = editorRef.current;
    const formatted = snippetText.includes('<')
      ? snippetText
      : snippetText.replace(/\r\n|\r|\n/g, '<br>');

    if (editor) {
      editor.focus();
      editor.innerHTML = formatted;
      setBody(formatted);
    } else {
      setBody(formatted);
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
    const requesterEmail = ticket?.requester?.email?.toLowerCase().trim();
    if (trimmed && trimmed === requesterEmail) {
      toast.error('The requester is already the primary recipient.');
      setCcInput('');
      return;
    }
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

  const cleanClipboardFragments = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
      // 1. CF_HTML header metadata (Version:1.0, StartHTML:..., EndHTML:..., StartFragment:..., EndFragment:..., SourceURL:...)
      .replace(/^(?:Version:\d+\.\d+|StartHTML:\d+|EndHTML:\d+|StartFragment:\d+|EndFragment:\d+|SourceURL:[^\r\n]*)\s*[\r\n]*/gim, '')
      // 2. Outlook / Word fragment and element comments
      .replace(/<!--\s*Start(?:Fragment|Element)\s*(?:-->|→|>)?/gi, '')
      .replace(/<!--\s*End(?:Fragment|Element)\s*(?:-->|→|>)?/gi, '')
      .replace(/<\/?(?:Start|End)(?:Fragment|Element)[^>]*>/gi, '')
      // 3. MSO / Office conditional comments: <!--[if ...]>...<![endif]-->
      .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '')
      // 4. Word XML tags like <o:p>, <w:WordDocument>
      .replace(/<\/?(?:o|w|m|v):[^>]*>/gi, '')
      // 5. Outer HTML boilerplate tags
      .replace(/<\/?(?:html|body|head|meta|link)[^>]*>/gi, '')
      .trim();
  };

  const cleanHtmlForPasting = (rawHtml: string): string => {
    if (!rawHtml) return '';
    let cleaned = rawHtml
      .replace(/^(?:Version:\d+\.\d+|StartHTML:\d+|EndHTML:\d+|StartFragment:\d+|EndFragment:\d+|SourceURL:[^\r\n]*)\s*[\r\n]*/gim, '')
      .replace(/<!--\s*Start(?:Fragment|Element)\s*(?:-->|→|>)?/gi, '')
      .replace(/<!--\s*End(?:Fragment|Element)\s*(?:-->|→|>)?/gi, '')
      .replace(/<\/?(?:Start|End)(?:Fragment|Element)[^>]*>/gi, '')
      .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '')
      .replace(/<\/?(?:o|w|m|v):[^>]*>/gi, '')
      .replace(/<\/?(?:html|body|head|meta|link|style|script|title)[^>]*>/gi, '')
    // Normalize font sizes, line heights and font families so pasted text matches the compact 13px composer text
    cleaned = cleaned
      .replace(/font-size\s*:\s*[^;"]+;?/gi, 'font-size: 13px;')
      .replace(/font-family\s*:\s*[^;"]+;?/gi, 'font-family: inherit;')
      .replace(/line-height\s*:\s*[^;"]+;?/gi, 'line-height: 1.4;');

    if (/<table[^>]*>/i.test(cleaned)) {
      cleaned = cleaned
        .replace(/<table(?![^>]*style=)[^>]*>/gi, '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1; margin: 6px 0; width: auto; max-width: 100%; font-size: 13px; line-height: 1.35; font-family: inherit;">')
        .replace(/<table([^>]*style=["'])([^"']*)(["'][^>]*)>/gi, '<table$1border-collapse: collapse; border: 1px solid #cbd5e1; margin: 6px 0; width: auto; max-width: 100%; font-size: 13px; line-height: 1.35; font-family: inherit; $2$3 border="1" cellpadding="5" cellspacing="0">')
        .replace(/<td(?![^>]*style=)[^>]*>/gi, '<td style="border: 1px solid #cbd5e1; padding: 4px 8px; font-family: inherit; font-size: 13px; line-height: 1.35;">')
        .replace(/<th(?![^>]*style=)[^>]*>/gi, '<th style="border: 1px solid #cbd5e1; padding: 4px 8px; font-family: inherit; background-color: #f8fafc; font-weight: 600; font-size: 13px; line-height: 1.35; white-space: nowrap; text-align: left;">');
    }

    return cleaned;
  };

  const executeFormat = (cmd: string, val: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(cmd, false, val);
      setBody(editorRef.current.innerHTML);
    }
  };

  const handleHighlight = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Specifically detect yellow highlight colors (#fef08a, #facc15, yellow, rgb(254, 240, 138), etc.)
    const isYellowHighlight = (c: string) => {
      if (!c) return false;
      const col = c.toLowerCase().trim();
      return (
        col.includes('254, 240, 138') ||
        col.includes('250, 204, 21') ||
        col.includes('255, 255, 0') ||
        col.includes('fef08a') ||
        col.includes('facc15') ||
        col === 'yellow'
      );
    };

    let alreadyHighlighted = false;

    // 1. Check document.queryCommandValue
    try {
      const qVal = document.queryCommandValue('backColor') || document.queryCommandValue('hiliteColor');
      if (qVal && isYellowHighlight(qVal)) {
        alreadyHighlighted = true;
      }
    } catch {
      // ignore
    }

    // 2. Check DOM tree of the current selection
    const range = sel.getRangeAt(0);
    let curr: Node | null = range.commonAncestorContainer;
    if (curr.nodeType === Node.TEXT_NODE) curr = curr.parentNode;

    while (curr && curr !== editorRef.current) {
      if (curr instanceof HTMLElement) {
        if (curr.tagName === 'MARK') {
          alreadyHighlighted = true;
          break;
        }
        if (curr.style.backgroundColor && isYellowHighlight(curr.style.backgroundColor)) {
          alreadyHighlighted = true;
          break;
        }
      }
      curr = curr.parentNode;
    }

    // 3. Also check within cloned contents if not collapsed
    if (!alreadyHighlighted && !range.collapsed) {
      const frag = range.cloneContents();
      const match = frag.querySelector?.('mark, [style*="background-color"]');
      if (match) {
        if (match.tagName === 'MARK') {
          alreadyHighlighted = true;
        } else if ((match as HTMLElement).style.backgroundColor && isYellowHighlight((match as HTMLElement).style.backgroundColor)) {
          alreadyHighlighted = true;
        }
      }
    }

    if (alreadyHighlighted) {
      // TOGGLE OFF / UNDO HIGHLIGHT
      if (range.collapsed) {
        let targetEl: HTMLElement | null = null;
        let walk: Node | null = range.startContainer;
        if (walk.nodeType === Node.TEXT_NODE) walk = walk.parentNode;
        while (walk && walk !== editorRef.current) {
          if (
            walk instanceof HTMLElement &&
            (walk.tagName === 'MARK' || (walk.style.backgroundColor && isYellowHighlight(walk.style.backgroundColor)))
          ) {
            targetEl = walk;
            break;
          }
          walk = walk.parentNode;
        }
        if (targetEl) {
          const newRange = document.createRange();
          newRange.selectNodeContents(targetEl);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      }

      // Execute transparent backColor / hiliteColor
      const applied = document.execCommand('hiliteColor', false, 'transparent');
      if (!applied) {
        document.execCommand('backColor', false, 'transparent');
      }

      // Clean up ancestor highlight style if inside a yellow highlight element
      let cleanNode: Node | null = sel.getRangeAt(0).commonAncestorContainer;
      if (cleanNode.nodeType === Node.TEXT_NODE) cleanNode = cleanNode.parentNode;
      while (cleanNode && cleanNode !== editorRef.current) {
        if (cleanNode instanceof HTMLElement) {
          if (cleanNode.tagName === 'MARK') {
            const p = cleanNode.parentNode;
            if (p) {
              while (cleanNode.firstChild) p.insertBefore(cleanNode.firstChild, cleanNode);
              p.removeChild(cleanNode);
            }
          } else if (cleanNode.style.backgroundColor && isYellowHighlight(cleanNode.style.backgroundColor)) {
            cleanNode.style.backgroundColor = '';
          }
        }
        cleanNode = cleanNode.parentNode;
      }

      // Also clean up any matching elements inside selection
      const spans = editorRef.current.querySelectorAll('mark, span');
      spans.forEach((node) => {
        const el = node as HTMLElement;
        if (el.tagName === 'MARK') {
          const p = el.parentNode;
          if (p) {
            while (el.firstChild) p.insertBefore(el.firstChild, el);
            p.removeChild(el);
          }
          return;
        }
        const bg = el.style.backgroundColor;
        if (isYellowHighlight(bg) || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'inherit') {
          if (sel.containsNode(el, true)) {
            el.style.backgroundColor = '';
          }
        }
        if (!el.getAttribute('style')?.trim() && el.tagName === 'SPAN' && el.attributes.length === 0) {
          const p = el.parentNode;
          if (p) {
            while (el.firstChild) p.insertBefore(el.firstChild, el);
            p.removeChild(el);
          }
        }
      });
    } else {
      // APPLY YELLOW HIGHLIGHT
      const applied = document.execCommand('hiliteColor', false, '#fef08a');
      if (!applied) {
        document.execCommand('backColor', false, '#fef08a');
      }
    }

    setBody(editorRef.current.innerHTML);
  };

  const handleInsertTable = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      const tableHtml = `
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1; margin: 6px 0; max-width: 100%; font-size: 13px; line-height: 1.35; font-family: inherit;">
  <thead>
    <tr style="background-color: #f8fafc;">
      <th style="border: 1px solid #cbd5e1; padding: 4px 8px; font-weight: 600; font-size: 13px;">Column 1</th>
      <th style="border: 1px solid #cbd5e1; padding: 4px 8px; font-weight: 600; font-size: 13px;">Column 2</th>
      <th style="border: 1px solid #cbd5e1; padding: 4px 8px; font-weight: 600; font-size: 13px;">Column 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 13px;">&nbsp;</td>
      <td style="border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 13px;">&nbsp;</td>
      <td style="border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 13px;">&nbsp;</td>
    </tr>
  </tbody>
</table><p><br></p>`.trim();
      document.execCommand('insertHTML', false, tableHtml);
      setBody(editorRef.current.innerHTML);
    }
  };

  const isBodyEmpty = useMemo(() => {
    if (!body) return true;
    const stripped = body
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return stripped.length === 0 && !body.includes('<table') && !body.includes('<img');
  }, [body]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedFiles.some((f) => f.isUploading)) {
      alert('Please wait for files/images to finish uploading before sending.');
      return;
    }
    const currentHtml = editorRef.current?.innerHTML || body;
    const cleanBody = cleanClipboardFragments(currentHtml);
    const textOnly = cleanBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    const readyFileIds = uploadedFiles.filter((f) => !f.isUploading && !f.id.startsWith('temp-')).map((f) => f.id);
    const effectiveBody = textOnly || cleanBody.includes('<table') || cleanBody.includes('<img')
      ? cleanBody
      : (readyFileIds.length > 0 ? '(Attached file)' : '');
    if (!effectiveBody || isSending || isUploading) return;

    // Flush any pending text in ccInput
    const finalCcList = [...ccList];
    const pendingCc = ccInput.trim().toLowerCase().replace(/,/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (pendingCc && emailRegex.test(pendingCc) && !finalCcList.includes(pendingCc)) {
      finalCcList.push(pendingCc);
    }

    await onSend(
      effectiveBody,
      isInternal && canWriteInternal,
      readyFileIds,
      !isInternal && finalCcList.length > 0 ? finalCcList : undefined,
    );
    setBody('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    uploadedFiles.forEach((f) => {
      if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    setUploadedFiles([]);
    setCcList([]);
    setCcInput('');
  };

  const handleUploadPastedFile = async (file: File) => {
    const ext = file.type.split('/')[1] || 'png';
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const dateStr = now.toISOString().slice(0, 10);
    const safeName = file.name && file.name !== 'image.png'
      ? file.name
      : `screenshot-${dateStr}-${timeStr}.${ext}`;
    const uploadableFile = new File([file], safeName, { type: file.type || 'image/png' });
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const previewUrl = URL.createObjectURL(file);

    setUploadedFiles((prev) => [
      ...prev,
      {
        id: tempId,
        name: safeName,
        previewUrl,
        isUploading: true,
        sizeBytes: file.size,
      },
    ]);
    setIsUploading(true);

    try {
      const result = await TicketsApi.uploadFile(uploadableFile);
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? { ...f, id: result.id, name: result.originalFilename || safeName, isUploading: false }
            : f,
        ),
      );
    } catch (err: any) {
      alert(`Failed to upload pasted image: ${err.message || err}`);
      setUploadedFiles((prev) => prev.filter((f) => f.id !== tempId));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newFiles = [...uploadedFiles];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const isImg = file.type.startsWith('image/');
        const previewUrl = isImg ? URL.createObjectURL(file) : undefined;
        const result = await TicketsApi.uploadFile(file);
        newFiles.push({
          id: result.id,
          name: result.originalFilename,
          previewUrl,
          sizeBytes: file.size,
        });
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
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl && file.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
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

            {isMinimized && !isBodyEmpty && (
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
                      gap: '8px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md, 6px)',
                      padding: file.previewUrl ? '4px 8px 4px 4px' : '4px 8px',
                      fontSize: '12px',
                    }}
                  >
                    {file.previewUrl ? (
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          backgroundColor: '#f1f5f9',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <span>📎</span>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 500,
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      {file.isUploading ? (
                        <span style={{ fontSize: '10px', color: 'var(--primary, #2563eb)', fontWeight: 600 }}>
                          Uploading...
                        </span>
                      ) : file.sizeBytes ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>
                          {(file.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      disabled={file.isUploading}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '14px',
                        lineHeight: 1,
                        padding: '2px',
                        marginLeft: '4px',
                      }}
                      title="Remove attachment"
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
                  onMouseDown={(e) => e.preventDefault()}
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
                  {/* Popover Header */}
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AtSign size={13} style={{ color: 'var(--primary, #2563eb)' }} />
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mention Teammate</span>
                    </div>
                    <span style={{ fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>
                      ↑↓ to navigate • ↵ to select
                    </span>
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
                            onMouseDown={(e) => e.preventDefault()}
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

              {/* Rich Text Formatting Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-app, #f8fafc)',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  flexWrap: 'wrap',
                  userSelect: 'none',
                }}
              >
                <button
                  type="button"
                  title="Bold (Ctrl+B)"
                  onClick={() => executeFormat('bold')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #475569)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Bold size={13} />
                </button>
                <button
                  type="button"
                  title="Italic (Ctrl+I)"
                  onClick={() => executeFormat('italic')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #475569)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Italic size={13} />
                </button>
                <button
                  type="button"
                  title="Underline (Ctrl+U)"
                  onClick={() => executeFormat('underline')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #475569)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Underline size={13} />
                </button>
                <button
                  type="button"
                  title="Strikethrough"
                  onClick={() => executeFormat('strikeThrough')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #475569)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Strikethrough size={13} />
                </button>

                <div style={{ width: '1px', height: '15px', backgroundColor: 'var(--border-subtle, #cbd5e1)', margin: '0 4px' }} />

                <button
                  type="button"
                  title="Bullet List"
                  onClick={() => executeFormat('insertUnorderedList')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #475569)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <List size={13} />
                </button>
                <button
                  type="button"
                  title="Numbered List"
                  onClick={() => executeFormat('insertOrderedList')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #475569)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <ListOrdered size={13} />
                </button>

                <div style={{ width: '1px', height: '15px', backgroundColor: 'var(--border-subtle, #cbd5e1)', margin: '0 4px' }} />

                <button
                  type="button"
                  title="Insert Table (or paste Excel cells directly)"
                  onClick={handleInsertTable}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary, #2563eb)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37,99,235,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Table size={13} />
                  <span style={{ fontSize: '11px' }}>Table</span>
                </button>

                <button
                  type="button"
                  title="Highlight / Unhighlight Text (Yellow)"
                  onMouseDown={(e) => {
                    // Prevent button click from losing editor text selection
                    e.preventDefault();
                  }}
                  onClick={handleHighlight}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ca8a04',
                    padding: '4px 7px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(250, 204, 21, 0.18)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Highlighter size={13} />
                  <span style={{ fontSize: '11px' }}>Highlight</span>
                </button>

                <div style={{ flex: 1 }} />
              </div>

              {/* Rich Visual Editor Area */}
              <div
                ref={editorRef}
                className="composer-textarea composer-rich-editor"
                contentEditable={true}
                data-placeholder={
                  isInternal && canWriteInternal
                    ? 'Write an internal note for teammates (type @ to mention a teammate)...'
                    : 'Type your reply to the customer (type @ to mention a teammate)...'
                }
                onInput={() => {
                  if (!editorRef.current) return;
                  const currentHtml = editorRef.current.innerHTML;
                  setBody(currentHtml);
                  const sel = window.getSelection();
                  if (sel && sel.anchorNode) {
                    checkMentionTrigger(sel.anchorNode.textContent || '', sel.anchorOffset);
                  } else {
                    setMentionQuery(null);
                  }
                }}
                onBlur={() => {
                  if (editorRef.current) {
                    setBody(editorRef.current.innerHTML);
                  }
                }}
                onPaste={(e) => {
                  const clipboardData = e.clipboardData;
                  if (!clipboardData) return;

                  // 1. Detect image files in clipboard (from Snipping Tool, screenshot, copy image)
                  const items = Array.from(clipboardData.items || []);
                  const imageFiles: File[] = [];

                  for (const item of items) {
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                      const file = item.getAsFile();
                      if (file) {
                        imageFiles.push(file);
                      }
                    }
                  }

                  if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
                    for (const file of Array.from(clipboardData.files)) {
                      if (file.type.startsWith('image/')) {
                        imageFiles.push(file);
                      }
                    }
                  }

                  if (imageFiles.length > 0) {
                    imageFiles.forEach((imgFile) => {
                      handleUploadPastedFile(imgFile);
                    });
                  }

                  // 2. Rich HTML vs Plain Text pasting
                  const htmlData = clipboardData.getData('text/html');
                  const textData = clipboardData.getData('text/plain') || clipboardData.getData('text');

                  if (imageFiles.length > 0 && (!textData || !textData.trim()) && (!htmlData || !htmlData.trim())) {
                    e.preventDefault();
                    return;
                  }

                  if (htmlData && /<(?:table|tr|td|b|strong|i|em|u|p|div|ul|ol|li|h[1-6]|span|a|font)[^>]*>/i.test(htmlData)) {
                    e.preventDefault();
                    const cleaned = cleanHtmlForPasting(htmlData);
                    document.execCommand('insertHTML', false, cleaned);
                    if (editorRef.current) {
                      setBody(editorRef.current.innerHTML);
                    }
                  } else if (textData) {
                    e.preventDefault();
                    const escaped = textData
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/\r\n|\r|\n/g, '<br>');
                    document.execCommand('insertHTML', false, escaped);
                    if (editorRef.current) {
                      setBody(editorRef.current.innerHTML);
                    }
                  }
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer?.types?.includes('Files')) {
                    e.preventDefault();
                  }
                }}
                onDrop={(e) => {
                  const files = Array.from(e.dataTransfer?.files || []);
                  const imageFiles = files.filter((f) => f.type.startsWith('image/'));
                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    imageFiles.forEach((imgFile) => handleUploadPastedFile(imgFile));
                  }
                }}
                onKeyDown={(e) => {
                  // Formatting shortcuts
                  if (e.metaKey || e.ctrlKey) {
                    const k = e.key.toLowerCase();
                    if (k === 'b') {
                      e.preventDefault();
                      executeFormat('bold');
                      return;
                    }
                    if (k === 'i') {
                      e.preventDefault();
                      executeFormat('italic');
                      return;
                    }
                    if (k === 'u') {
                      e.preventDefault();
                      executeFormat('underline');
                      return;
                    }
                  }

                  // Mentions navigation
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
                    const sel = window.getSelection();
                    if (sel && sel.isCollapsed && sel.anchorNode) {
                      const node = sel.anchorNode;
                      const offset = sel.anchorOffset;
                      if (node.nodeType === Node.TEXT_NODE) {
                        const textBefore = node.textContent?.slice(0, offset) || '';

                        for (const staff of staffUsers) {
                          const name = staff.fullName || staff.email;
                          if (!name) continue;
                          const tagWithSpace = `@${name} `;
                          const tagWithoutSpace = `@${name}`;

                          if (textBefore.endsWith(tagWithSpace)) {
                            e.preventDefault();
                            const range = document.createRange();
                            range.setStart(node, offset - tagWithSpace.length);
                            range.setEnd(node, offset);
                            range.deleteContents();
                            if (editorRef.current) {
                              setBody(editorRef.current.innerHTML);
                            }
                            setMentionQuery(null);
                            return;
                          }

                          if (textBefore.endsWith(tagWithoutSpace)) {
                            e.preventDefault();
                            const range = document.createRange();
                            range.setStart(node, offset - tagWithoutSpace.length);
                            range.setEnd(node, offset);
                            range.deleteContents();
                            if (editorRef.current) {
                              setBody(editorRef.current.innerHTML);
                            }
                            setMentionQuery(null);
                            return;
                          }
                        }

                        // Also match any @Mention pattern against staff list case-insensitively
                        const mentionMatch = textBefore.match(/@([a-zA-Z0-9._-]+(?:\s[a-zA-Z0-9._-]+)?)\s?$/);
                        if (mentionMatch) {
                          const matchedTag = mentionMatch[0];
                          const candidateName = mentionMatch[1].toLowerCase();
                          const isKnownStaff = staffUsers.some((u) => {
                            const fn = (u.fullName || '').toLowerCase();
                            const em = (u.email || '').toLowerCase();
                            return fn === candidateName || em === candidateName || em.split('@')[0] === candidateName;
                          });
                          if (isKnownStaff) {
                            e.preventDefault();
                            const range = document.createRange();
                            range.setStart(node, offset - matchedTag.length);
                            range.setEnd(node, offset);
                            range.deleteContents();
                            if (editorRef.current) {
                              setBody(editorRef.current.innerHTML);
                            }
                            setMentionQuery(null);
                            return;
                          }
                        }
                      }
                    }
                  }
                }}
                onClick={() => {
                  const sel = window.getSelection();
                  if (sel && sel.anchorNode) {
                    checkMentionTrigger(sel.anchorNode.textContent || '', sel.anchorOffset);
                  }
                }}
                onKeyUp={() => {
                  const sel = window.getSelection();
                  if (sel && sel.anchorNode) {
                    checkMentionTrigger(sel.anchorNode.textContent || '', sel.anchorOffset);
                  }
                }}
                style={{ flex: 1, minHeight: '180px', height: '100%', outline: 'none' }}
              />
            </div>

            {isBodyEmpty && uploadedFiles.length === 0 && (
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
                <span>⚠️ Message text or an attachment is required to submit a reply or note.</span>
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
                disabled={isSending || isUploading || (isBodyEmpty && uploadedFiles.length === 0)}
                className={`btn ${isInternal && canWriteInternal ? 'btn-secondary' : 'btn-primary'}`}
                style={{
                  ...(isInternal && canWriteInternal
                    ? { backgroundColor: '#f59e0b', color: '#ffffff', fontWeight: 600 }
                    : {}),
                  ...(isSending || isUploading || (isBodyEmpty && uploadedFiles.length === 0)
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
