import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Sparkles,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  FileText,
  Tag,
  ArrowRight,
  Eye,
  Code,
} from 'lucide-react';
import {
  SnippetTemplate,
  TicketSnippetContext,
  getAllSnippets,
  saveCustomSnippet,
  deleteCustomSnippet,
  resolveSnippetPlaceholders,
} from './snippets';

interface SnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSnippet: (resolvedText: string) => void;
  ticket?: TicketSnippetContext;
  currentUserName?: string;
  initialCreateMode?: boolean;
}

export const SnippetModal: React.FC<SnippetModalProps> = ({
  isOpen,
  onClose,
  onSelectSnippet,
  ticket,
  currentUserName,
  initialCreateMode = false,
}) => {
  const [snippets, setSnippets] = useState<SnippetTemplate[]>(() => getAllSnippets());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>(() => {
    const list = getAllSnippets();
    return list[0]?.id || '';
  });
  const [isEditing, setIsEditing] = useState(initialCreateMode);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<'resolved' | 'raw'>('resolved');

  // Form state for Create / Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SnippetTemplate['category']>('General');
  const [formDescription, setFormDescription] = useState('');
  const [formBody, setFormBody] = useState('');

  const refreshSnippets = () => {
    const updated = getAllSnippets();
    setSnippets(updated);
    return updated;
  };

  useEffect(() => {
    if (isOpen) {
      setIsEditing(initialCreateMode);
      if (initialCreateMode) {
        setEditingId(null);
        setFormName('');
        setFormCategory('General');
        setFormDescription('');
        setFormBody('');
      }
      refreshSnippets();
    }
  }, [isOpen, initialCreateMode]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    snippets.forEach((s) => cats.add(s.category));
    return ['All', ...Array.from(cats)];
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.body.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [snippets, selectedCategory, searchQuery]);

  const selectedSnippet = useMemo(() => {
    return (
      snippets.find((s) => s.id === selectedSnippetId) ||
      filteredSnippets[0] ||
      snippets[0] ||
      null
    );
  }, [snippets, selectedSnippetId, filteredSnippets]);

  const handleStartCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormCategory('General');
    setFormDescription('');
    setFormBody('');
    setIsEditing(true);
  };

  const handleStartEdit = (snippet: SnippetTemplate) => {
    setEditingId(snippet.id);
    setFormName(snippet.name);
    setFormCategory(snippet.category);
    setFormDescription(snippet.description || '');
    setFormBody(snippet.body);
    setIsEditing(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBody.trim()) return;

    const saved = saveCustomSnippet({
      id: editingId || undefined,
      name: formName.trim(),
      category: formCategory,
      description: formDescription.trim() || undefined,
      body: formBody.trim(),
    });

    const updatedList = refreshSnippets();
    setSelectedSnippetId(saved.id);
    setIsEditing(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this custom snippet template?')) {
      deleteCustomSnippet(id);
      const updated = refreshSnippets();
      if (selectedSnippetId === id) {
        setSelectedSnippetId(updated[0]?.id || '');
      }
    }
  };

  const handleInsert = (snippet: SnippetTemplate) => {
    const resolved = resolveSnippetPlaceholders(snippet.body, ticket, currentUserName);
    onSelectSnippet(resolved);
    onClose();
  };

  const handleCopy = (snippet: SnippetTemplate) => {
    const resolved = resolveSnippetPlaceholders(snippet.body, ticket, currentUserName);
    navigator.clipboard.writeText(resolved);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertPlaceholderIntoForm = (placeholder: string) => {
    setFormBody((prev) => `${prev} ${placeholder}`);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          height: '620px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-subtle, rgba(0,0,0,0.1))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #0f172a)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                {isEditing ? (editingId ? 'Edit Snippet' : 'Create New Snippet') : 'Snippet Templates'}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                Standardized reply templates with dynamic ticket placeholders
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <Plus size={14} />
                <span>Add Snippet</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        {isEditing ? (
          /* Create / Edit Snippet Form */
          <form
            onSubmit={handleSaveForm}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              overflowY: 'auto',
              gap: '16px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Snippet Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer Follow-up Template"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    backgroundColor: 'var(--bg-surface, #fff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    backgroundColor: 'var(--bg-surface, #fff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="General">General</option>
                  <option value="Resolution">Resolution</option>
                  <option value="Acknowledgment">Acknowledgment</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Internal">Internal</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Description (Optional)
              </label>
              <input
                type="text"
                placeholder="Brief summary of when to use this template..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  backgroundColor: 'var(--bg-surface, #fff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Template Body *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginRight: '4px' }}>
                    Insert placeholder:
                  </span>
                  {[
                    { label: 'Ticket ID', val: '${Cases.Request Id}' },
                    { label: 'Subject', val: '${Cases.Subject}' },
                    { label: 'Contact Name', val: '${Cases.Contact Name}' },
                    { label: 'Agent Name', val: '${Agent.Name}' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => insertPlaceholderIntoForm(p.val)}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
                        border: '1px solid var(--border-medium, #cbd5e1)',
                        color: 'var(--primary, #2563eb)',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                required
                rows={8}
                placeholder="Type your template text here..."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  backgroundColor: 'var(--bg-surface, #fff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Save Snippet
              </button>
            </div>
          </form>
        ) : (
          /* Two-pane Snippet Explorer */
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>
            {/* Left Sidebar: Categories & Snippet List */}
            <div
              style={{
                borderRight: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
              }}
            >
              {/* Search Bar */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-muted, #94a3b8)' }} />
                  <input
                    type="text"
                    placeholder="Search snippets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      width: '100%',
                      fontSize: '12px',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Pills */}
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  padding: '8px 14px',
                  overflowX: 'auto',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                }}
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      border: 'none',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      fontWeight: selectedCategory === cat ? 600 : 500,
                      backgroundColor:
                        selectedCategory === cat
                          ? 'var(--primary, #2563eb)'
                          : 'var(--bg-surface-elevated, #f1f5f9)',
                      color: selectedCategory === cat ? '#ffffff' : 'var(--text-muted, #64748b)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Snippet Items List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {filteredSnippets.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <FileText size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                    <p style={{ fontSize: '13px', margin: 0 }}>No snippets found</p>
                    <p style={{ fontSize: '11px', margin: '4px 0 0' }}>Try a different search or add a new one.</p>
                  </div>
                ) : (
                  filteredSnippets.map((snippet) => {
                    const isSelected = selectedSnippet?.id === snippet.id;
                    return (
                      <div
                        key={snippet.id}
                        onClick={() => setSelectedSnippetId(snippet.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          marginBottom: '4px',
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? 'var(--primary-surface, rgba(37, 99, 235, 0.1))'
                            : 'transparent',
                          border: isSelected
                            ? '1px solid var(--primary-border, rgba(37, 99, 235, 0.3))'
                            : '1px solid transparent',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: isSelected ? 600 : 500,
                              color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '190px',
                            }}
                          >
                            {snippet.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: snippet.isDefault
                                ? 'rgba(100, 116, 139, 0.1)'
                                : 'rgba(16, 185, 129, 0.12)',
                              color: snippet.isDefault ? '#64748b' : '#059669',
                            }}
                          >
                            {snippet.category}
                          </span>
                        </div>

                        {snippet.description && (
                          <p
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-muted, #64748b)',
                              margin: '2px 0 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {snippet.description}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Snippet Preview & Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-surface, #fff)' }}>
              {selectedSnippet ? (
                <>
                  {/* Preview Header */}
                  <div
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                          {selectedSnippet.name}
                        </h3>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            padding: '1px 8px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            color: 'var(--primary, #2563eb)',
                          }}
                        >
                          {selectedSnippet.category}
                        </span>
                      </div>
                      {selectedSnippet.description && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '3px 0 0' }}>
                          {selectedSnippet.description}
                        </p>
                      )}
                    </div>

                    {/* Mode Toggle (Resolved vs Raw) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
                        padding: '2px',
                        borderRadius: '6px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewMode('resolved')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          backgroundColor: previewMode === 'resolved' ? '#ffffff' : 'transparent',
                          color: previewMode === 'resolved' ? 'var(--primary, #2563eb)' : 'var(--text-muted)',
                          boxShadow: previewMode === 'resolved' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        }}
                      >
                        <Eye size={12} /> Resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('raw')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          backgroundColor: previewMode === 'raw' ? '#ffffff' : 'transparent',
                          color: previewMode === 'raw' ? 'var(--primary, #2563eb)' : 'var(--text-muted)',
                          boxShadow: previewMode === 'raw' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        }}
                      >
                        <Code size={12} /> Template
                      </button>
                    </div>
                  </div>

                  {/* Preview Body */}
                  <div
                    style={{
                      flex: 1,
                      padding: '20px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-surface-elevated, #fafafa)',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        border: '1px solid var(--border-medium, #e2e8f0)',
                        borderRadius: '8px',
                        padding: '18px',
                        whiteSpace: 'pre-wrap',
                        fontFamily: previewMode === 'raw' ? 'monospace' : 'inherit',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {previewMode === 'resolved'
                        ? resolveSnippetPlaceholders(selectedSnippet.body, ticket, currentUserName)
                        : selectedSnippet.body}
                    </div>

                    {previewMode === 'resolved' && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(37, 99, 235, 0.06)',
                          border: '1px solid rgba(37, 99, 235, 0.15)',
                          fontSize: '11.5px',
                          color: 'var(--primary, #2563eb)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Sparkles size={13} />
                        <span>
                          Ticket placeholders (ID: <strong>{ticket?.ticketNumber ? `#${ticket.ticketNumber}` : '#TICKET'}</strong>, Subject, Customer Name) have been populated automatically.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Preview Footer Actions */}
                  <div
                    style={{
                      padding: '14px 20px',
                      borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!selectedSnippet.isDefault && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(selectedSnippet)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid var(--border-medium)',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(selectedSnippet.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid rgba(225, 29, 72, 0.2)',
                              background: 'transparent',
                              color: '#e11d48',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedSnippet)}
                        className="btn btn-secondary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          fontSize: '12.5px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                        <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInsert(selectedSnippet)}
                        className="btn btn-primary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 18px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Sparkles size={14} />
                        <span>Insert into Reply</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Select a snippet to preview
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
