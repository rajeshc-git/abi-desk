import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Check, Search } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useSearch } from '../../context/SearchContext';

export interface TagItem {
  id?: string;
  name: string;
  slug: string;
  color?: string;
}

export interface TicketTagWrapper {
  tag: TagItem;
}

interface TicketTagManagerProps {
  ticketId: string;
  tags?: TicketTagWrapper[];
  onTagsChange?: (tags: TicketTagWrapper[]) => void;
  readonly?: boolean;
}

export const TicketTagManager: React.FC<TicketTagManagerProps> = ({
  ticketId,
  tags = [],
  onTagsChange,
  readonly = false,
}) => {
  const toast = useToast();
  const { setSelectedTag } = useSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch all tenant tags when dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchTags = async () => {
      try {
        const res = await ApiClient.get('/tags');
        if (Array.isArray(res)) {
          setAvailableTags(res);
        }
      } catch {
        // non-blocking
      }
    };
    fetchTags();
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentTagSlugs = new Set(tags.map((t) => t.tag.slug.toLowerCase()));

  const handleAddTag = async (tag: TagItem) => {
    if (isUpdating) return;
    setIsUpdating(true);
    const newTags = [...tags, { tag }];
    onTagsChange?.(newTags);

    try {
      const res = await ApiClient.post(`/tickets/${ticketId}/tags`, { tags: [tag.name] });
      if (res?.tags) {
        onTagsChange?.(res.tags);
      }
      toast.success(`Tagged with "${tag.name}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to attach tag');
      onTagsChange?.(tags); // rollback
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveTag = async (slug: string, tagName: string) => {
    if (isUpdating || readonly) return;
    setIsUpdating(true);
    const newTags = tags.filter((t) => t.tag.slug.toLowerCase() !== slug.toLowerCase());
    onTagsChange?.(newTags);

    try {
      const res = await ApiClient.delete(`/tickets/${ticketId}/tags/${slug}`);
      if (res?.tags) {
        onTagsChange?.(res.tags);
      }
      toast.success(`Removed tag "${tagName}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove tag');
      onTagsChange?.(tags); // rollback
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredAvailableTags = availableTags.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
      {/* Existing Tags */}
      {tags.map((tItem, idx) => {
        const tag = tItem.tag;
        if (!tag) return null;
        const color = tag.color || '#3b82f6';

        return (
          <span
            key={idx}
            className="tag-pill"
            onClick={() => setSelectedTag({ name: tag.name, slug: tag.slug, color: tag.color })}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              height: '32px',
              boxSizing: 'border-box',
              backgroundColor: `${color}15`,
              color: color,
              border: `1px solid ${color}40`,
              borderRadius: '6px',
              padding: '0 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={`Click to filter by "${tag.name}"`}
          >
            <span>{tag.name}</span>
            {!readonly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag.slug, tag.name);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.7,
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                title={`Remove ${tag.name}`}
              >
                <X size={11} />
              </button>
            )}
          </span>
        );
      })}

      {/* Add Tag Button & Dropdown */}
      {!readonly && (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            className="tag-pill"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              height: '32px',
              boxSizing: 'border-box',
              fontSize: '12px',
              fontWeight: 600,
              padding: '0 10px',
              borderRadius: '6px',
              border: isOpen ? '1px solid var(--primary-border, #bfdbfe)' : '1px solid var(--border-medium, #e2e8f0)',
              backgroundColor: isOpen ? 'var(--primary-surface, #eff6ff)' : 'var(--bg-surface, #ffffff)',
              color: isOpen ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #475569)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isOpen) {
                e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
                e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isOpen) {
                e.currentTarget.style.borderColor = 'var(--border-medium, #e2e8f0)';
                e.currentTarget.style.color = 'var(--text-secondary, #475569)';
              }
            }}
          >
            <Plus size={13} style={{ color: 'var(--text-muted)' }} />
            <span>Tag</span>
          </button>

          {/* Floating Tag Picker Popover */}
          {isOpen && (
            <div
              className="tag-picker-popover"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '240px',
                maxWidth: 'calc(100vw - 32px)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                boxShadow:
                  '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                zIndex: 1050,
                padding: '8px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  marginBottom: '8px',
                }}
              >
                <Search size={13} style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Find or add tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Tags List */}
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {filteredAvailableTags.length > 0 ? (
                  filteredAvailableTags.map((tag) => {
                    const isAttached = currentTagSlugs.has(tag.slug.toLowerCase());
                    const tagColor = tag.color || '#3b82f6';

                    return (
                      <div
                        key={tag.id || tag.slug}
                        onClick={() => {
                          if (isAttached) {
                            handleRemoveTag(tag.slug, tag.name);
                          } else {
                            handleAddTag(tag);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: isAttached ? 'var(--primary-surface)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                          marginBottom: '2px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isAttached) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isAttached)
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: tagColor,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: isAttached ? 700 : 500,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {tag.name}
                          </span>
                        </div>
                        {isAttached && (
                          <Check size={14} style={{ color: 'var(--primary)' }} />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      padding: '12px 8px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                    }}
                  >
                    {availableTags.length === 0
                      ? 'No tags created yet. Add tags in Admin Setup.'
                      : 'No matching tags found.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
