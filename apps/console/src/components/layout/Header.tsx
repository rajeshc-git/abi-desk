import React from 'react';
import { Search, Layers, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSearch } from '../../context/SearchContext';

export const Header: React.FC = () => {
  const { brands, activeBrandId, setActiveBrandId } = useAuth();
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useSearch();

  const isAnalyticsPage = location.pathname === '/analytics';

  return (
    <header className="app-header">
      <div className="header-left">
        {!isAnalyticsPage && (
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search tickets, customers, or tags... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="header-right">
        {brands.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Notifications"
        >
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
};
