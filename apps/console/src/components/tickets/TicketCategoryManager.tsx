import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Check, Search, Folder } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useSearch } from '../../context/SearchContext';

export interface CategoryItem {
  id?: string;
  name: string;
  slug: string;
  color?: string;
  keywords?: string | null;
}

interface TicketCategoryManagerProps {
  ticketId: string;
  category?: string | null;
  onCategoryChange?: (category: string | null) => void;
  readonly?: boolean;
}

export const TicketCategoryManager: React.FC<TicketCategoryManagerProps> = ({
  ticketId,
  category,
  onCategoryChange,
  readonly = false,
}) => {
  const toast = useToast();
  const { setSelectedCategory } = useSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch all tenant categories when dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchCategories = async () => {
      try {
        const res = await ApiClient.get('/categories');
        if (Array.isArray(res)) {
          setAvailableCategories(res);
        }
      } catch {
        // non-blocking
      }
    };
    fetchCategories();
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

  const matchedCat = availableCategories.find(
    (c) => c.name.toLowerCase() === (category || '').toLowerCase(),
  );
  const categoryColor = matchedCat?.color || '#6366f1';

  const handleSelectCategory = async (cat: CategoryItem) => {
    if (isUpdating || readonly) return;
    setIsUpdating(true);
    const prev = category;
    onCategoryChange?.(cat.name);
    setIsOpen(false);

    try {
      await ApiClient.patch(`/tickets/${ticketId}`, { category: cat.name });
      toast.success(`Category set to "${cat.name}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update category');
      onCategoryChange?.(prev ?? null); // rollback
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveCategory = async () => {
    if (isUpdating || readonly || !category) return;
    setIsUpdating(true);
    const prev = category;
    onCategoryChange?.(null);

    try {
      await ApiClient.patch(`/tickets/${ticketId}`, { category: null });
      toast.success('Category removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove category');
      onCategoryChange?.(prev); // rollback
    } finally {
      setIsUpdating(false);
    }
  };

  const filtered = availableCategories.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.keywords && c.keywords.toLowerCase().includes(q))
    );
  });

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
      }}
    >
      {/* Assigned Category Badge */}
      {category ? (
        <span
          className="category-pill"
          onClick={(e) => {
            if (!readonly) {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '28px',
            boxSizing: 'border-box',
            backgroundColor: `${categoryColor}14`,
            color: categoryColor,
            border: `1px solid ${categoryColor}35`,
            borderRadius: '6px',
            padding: '0 8px',
            fontSize: '11.5px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
            cursor: readonly ? 'default' : 'pointer',
          }}
          title={readonly ? undefined : 'Click to change category'}
        >
          <Folder size={12} />
          <span>{category}</span>
          {!readonly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveCategory();
              }}
              title="Remove category"
              style={{
                background: 'transparent',
                border: 'none',
                color: categoryColor,
                cursor: 'pointer',
                padding: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                lineHeight: 1,
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                opacity: 0.7,
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.backgroundColor = `${categoryColor}25`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={10} />
            </button>
          )}
        </span>
      ) : (
        /* If no category is assigned yet, show "+ Category" button */
        !readonly && (
          <button
            type="button"
            className="category-pill"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              height: '28px',
              boxSizing: 'border-box',
              backgroundColor: isOpen ? 'var(--primary-surface, #eff6ff)' : 'var(--bg-surface, #ffffff)',
              color: isOpen ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #475569)',
              border: isOpen ? '1px solid var(--primary-border, #bfdbfe)' : '1px solid var(--border-medium, #e2e8f0)',
              borderRadius: '6px',
              padding: '0 8px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Folder size={12} style={{ color: 'var(--text-muted)' }} />
            <span>Category</span>
          </button>
        )
      )}

      {/* Floating Category Picker Popover */}
      {isOpen && (
        <div
          className="category-picker-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '240px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '8px',
            boxShadow:
              '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '5px',
              padding: '4px 8px',
            }}
          >
            <Search size={12} style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search category or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12px',
                color: 'var(--text-primary)',
                width: '100%',
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
                <X size={10} />
              </button>
            )}
          </div>

          {/* Categories List */}
          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  padding: '12px 8px',
                  textAlign: 'center',
                }}
              >
                No categories found
              </div>
            ) : (
              filtered.map((cat) => {
                const isSelected =
                  (category || '').toLowerCase() === cat.name.toLowerCase();
                const color = cat.color || '#6366f1';

                return (
                  <button
                    key={cat.id || cat.slug}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: isSelected ? `${color}15` : 'transparent',
                      color: isSelected ? color : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: isSelected ? 600 : 500 }}>{cat.name}</span>
                    </div>
                    {isSelected && <Check size={12} style={{ color }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
