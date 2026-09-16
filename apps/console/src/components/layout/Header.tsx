import React, { useState, useEffect, useRef } from 'react';
import { Search, Layers, Bell, Tag as TagIcon, Folder, X, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSearch, type SearchTag, type SearchCategory } from '../../context/SearchContext';
import { ApiClient } from '../../api/client';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { brands, activeBrandId, setActiveBrandId } = useAuth();
  const location = useLocation();
  const {
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    selectedCategory,
    setSelectedCategory,
    selectedOrganization,
    setSelectedOrganization,
    selectedProduct,
    setSelectedProduct,
  } = useSearch();

  const [tagsList, setTagsList] = useState<SearchTag[]>([]);
  const [categoriesList, setCategoriesList] = useState<SearchCategory[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hideSearchBar =
    location.pathname === '/analytics' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/db');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tagsRes, categoriesRes] = await Promise.all([
          ApiClient.get('/tags'),
          ApiClient.get('/categories'),
        ]);
        if (Array.isArray(tagsRes)) setTagsList(tagsRes);
        if (Array.isArray(categoriesRes)) setCategoriesList(categoriesRes);
      } catch {
        // non-blocking
      }
    };
    fetchData();
  }, []);

  // Filter matching tags and categories based on typed query
  const queryTrim = searchQuery.trim().toLowerCase();
  const matchingTags = queryTrim
    ? tagsList.filter(
      (t) =>
        t.name.toLowerCase().includes(queryTrim) ||
        t.slug.toLowerCase().includes(queryTrim) ||
        (t.domains && t.domains.toLowerCase().includes(queryTrim)),
    )
    : [];

  const matchingCategories = queryTrim
    ? categoriesList.filter(
      (c) =>
        c.name.toLowerCase().includes(queryTrim) ||
        c.slug.toLowerCase().includes(queryTrim) ||
        (c.keywords && c.keywords.toLowerCase().includes(queryTrim)),
    )
    : [];

  const isChatPage = location.pathname.startsWith('/chat');

  const hasSuggestions = !isChatPage && (matchingTags.length > 0 || matchingCategories.length > 0);

  const handleSelectTag = (tag: SearchTag) => {
    setSelectedTag(tag);
    setSelectedCategory(null);
    setSearchQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSelectCategory = (cat: SearchCategory) => {
    setSelectedCategory(cat);
    setSelectedTag(null);
    setSearchQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (showSuggestions) {
        if (matchingCategories.length > 0) {
          e.preventDefault();
          handleSelectCategory(matchingCategories[0]);
        } else if (matchingTags.length > 0) {
          e.preventDefault();
          handleSelectTag(matchingTags[0]);
        }
      }
    } else if (e.key === 'Backspace' && searchQuery === '') {
      if (selectedCategory) {
        setSelectedCategory(null);
      } else if (selectedTag) {
        setSelectedTag(null);
      } else if (selectedOrganization) {
        setSelectedOrganization(null);
      } else if (selectedProduct) {
        setSelectedProduct(null);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Global Ctrl+K / Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      <div className="header-left" style={{ flex: 1, minWidth: 0 }}>
        {onToggleSidebar && (
          <button
            type="button"
            className="hamburger-btn"
            onClick={onToggleSidebar}
            title="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
        )}
        {!hideSearchBar && (
          <div
            ref={wrapperRef}
            className="search-input-wrapper"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              border: isFocused ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0 10px',
              gap: '6px',
              width: '100%',
              height: '32px',
              boxSizing: 'border-box',
              flex: '1 1 auto',
              transition: 'all 0.15s ease',
              boxShadow: isFocused ? '0 0 0 3px var(--primary-surface)' : 'none',
              cursor: 'text',
            }}
            onClick={() => inputRef.current?.focus()}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

            {/* Selected Tag Chip */}
            {!isChatPage && selectedTag && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: selectedTag.color ? `${selectedTag.color}18` : '#eff6ff',
                  border: `1px solid ${selectedTag.color ? `${selectedTag.color}40` : '#bfdbfe'}`,
                  color: selectedTag.color || '#1d4ed8',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <TagIcon size={10} />
                <span>{selectedTag.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTag(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    lineHeight: 1,
                    borderRadius: '50%',
                    width: '12px',
                    height: '12px',
                    opacity: 0.75,
                  }}
                  title="Remove tag filter"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {/* Selected Category Chip */}
            {!isChatPage && selectedCategory && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: selectedCategory.color ? `${selectedCategory.color}18` : '#f5f3ff',
                  border: `1px solid ${selectedCategory.color ? `${selectedCategory.color}40` : '#ddd6fe'}`,
                  color: selectedCategory.color || '#7c3aed',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <Folder size={10} />
                <span>{selectedCategory.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCategory(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    lineHeight: 1,
                    borderRadius: '50%',
                    width: '12px',
                    height: '12px',
                    opacity: 0.75,
                  }}
                  title="Remove category filter"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {/* Selected Organization Chip */}
            {!isChatPage && selectedOrganization && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#0284c7',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span>🏢 {selectedOrganization}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrganization(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    lineHeight: 1,
                    borderRadius: '50%',
                    width: '12px',
                    height: '12px',
                    opacity: 0.75,
                  }}
                  title="Remove organization filter"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {/* Selected Product Chip */}
            {!isChatPage && selectedProduct && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  color: '#9333ea',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span>📦 {selectedProduct}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProduct(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    lineHeight: 1,
                    borderRadius: '50%',
                    width: '12px',
                    height: '12px',
                    opacity: 0.75,
                  }}
                  title="Remove product filter"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              placeholder={
                isChatPage
                  ? 'Search chats... (Ctrl+K)'
                  : selectedTag
                    ? 'Search within tag...'
                    : selectedCategory
                      ? 'Search within category...'
                      : selectedOrganization
                        ? 'Search org...'
                        : selectedProduct
                          ? 'Search product...'
                          : 'Search tickets... (Ctrl+K)'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setIsFocused(true);
                if (hasSuggestions) setShowSuggestions(true);
              }}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: 'var(--text-primary)',
                padding: '4px 0',
                minWidth: 0,
              }}
            />

            {/* Suggestions Popover */}
            {showSuggestions && hasSuggestions && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  boxShadow:
                    '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                  zIndex: 1000,
                  padding: '6px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                }}
              >
                {/* Categories Header & Items */}
                {matchingCategories.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Matching Categories
                    </div>
                    {matchingCategories.map((cat, idx) => (
                      <div
                        key={cat.id || idx}
                        onClick={() => handleSelectCategory(cat)}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'background-color 0.15s ease',
                          marginBottom: '2px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: cat.color || '#6366f1',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                            {cat.name}
                          </span>
                          {cat.keywords && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                maxWidth: '240px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              ({(() => {
                                const list = cat.keywords.split(/[,;\n]+/).map((k: string) => k.trim()).filter(Boolean);
                                if (list.length <= 1) return list[0];
                                return `${list[0]} +${list.length - 1} more`;
                              })()})
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: '#f5f3ff',
                            color: '#7c3aed',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          CATEGORY
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {/* Tags Header & Items */}
                {matchingTags.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        padding: '6px 8px 4px 8px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Matching Tags
                    </div>
                    {matchingTags.map((tag, idx) => (
                      <div
                        key={tag.id || idx}
                        onClick={() => handleSelectTag(tag)}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: tag.color || '#3b82f6',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                            {tag.name}
                          </span>
                          {tag.domains && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                maxWidth: '240px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              ({(() => {
                                const list = tag.domains.split(/[,;\n]+/).map((k: string) => k.trim()).filter(Boolean);
                                if (list.length <= 1) return list[0];
                                return `${list[0]} +${list.length - 1} more`;
                              })()})
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          TAG
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="header-right">
        {brands.length > 0 && (
          <div className="header-brand-select-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="brand-select"
              value={activeBrandId || ''}
              onChange={(e) => setActiveBrandId(e.target.value)}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          className="notification-btn header-action-btn"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
          title="Notifications"
        >
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
};

