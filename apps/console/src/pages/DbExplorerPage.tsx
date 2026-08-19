import React, { useState, useEffect } from 'react';
import { Database, Play, AlertCircle, Table, RefreshCw, Layers } from 'lucide-react';
import { ApiClient } from '../api/client';
import { ZohoDeskLogo } from '../components/common/ZohoDeskLogo';

export const DbExplorerPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Query inputs
  const [sql, setSql] = useState('SELECT * FROM "user" LIMIT 20;');
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    fields: { name: string }[];
    rows: any[];
    rowCount: number;
    command: string;
  } | null>(null);

  const handleConnect = async () => {
    setIsLoadingMeta(true);
    setError(null);
    try {
      const res = await ApiClient.get<{ success: boolean; tables?: string[]; error?: string }>(
        '/db-explorer/meta',
      );
      if (res.success) {
        setTables(res.tables || []);
        setIsConnected(true);
      } else {
        setError(res.error || 'Failed to connect to the database.');
        setIsConnected(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error connecting to database.');
      setIsConnected(false);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setIsExecuting(true);
    setError(null);
    setQueryResult(null);
    try {
      const res = await ApiClient.post('/db-explorer/query', { sql });
      if (res.success) {
        setQueryResult(res);
      } else {
        setError(res.error || 'SQL query execution failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Error executing SQL query.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Run initial connection using defaults from .env
  useEffect(() => {
    handleConnect();
  }, []);

  const selectTable = (tableName: string) => {
    const doubleQuoted = `"${tableName}"`;
    setSql(`SELECT * FROM ${doubleQuoted} LIMIT 50;`);
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          height: '56px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ZohoDeskLogo size={28} showText={false} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            Database Explorer
          </span>
          <span
            style={{
              fontSize: '11px',
              backgroundColor: isConnected ? '#d1fae5' : '#fee2e2',
              color: isConnected ? '#065f46' : '#991b1b',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 700,
            }}
          >
            {isConnected ? 'Connected to .env Database' : 'Disconnected'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href="/inbox"
            style={{
              fontSize: '13px',
              color: 'var(--primary)',
              fontWeight: 600,
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary-surface)',
            }}
          >
            Back to Support Inbox
          </a>
        </div>
      </header>

      {/* Main Workspace Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar (Tables list) */}
        <div
          style={{
            width: '280px',
            borderRight: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Connection Status panel */}
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <button
              onClick={handleConnect}
              disabled={isLoadingMeta}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {isLoadingMeta ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh Tables
            </button>
          </div>

          {/* Tables List */}
          <div style={{ padding: '16px', flex: 1 }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 750,
                color: '#475569',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Layers size={15} />
              Tables ({tables.length})
            </h3>

            {tables.length === 0 ? (
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginTop: '20px',
                }}
              >
                No tables loaded. Click refresh to connect.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {tables.map((t) => (
                  <button
                    key={t}
                    onClick={() => selectTable(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      width: '100%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#334155',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Table size={14} color="#64748b" />
                    <span style={{ fontFamily: 'monospace' }}>{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane (Query & Results Grid) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Query Editor */}
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <label style={{ fontSize: '13px', fontWeight: 750, color: '#475569' }}>
                SQL Query Workspace
              </label>
              <button
                onClick={handleExecute}
                disabled={isExecuting || !isConnected}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isConnected ? 'pointer' : 'not-allowed',
                  opacity: isConnected ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Play size={14} />
                Execute Query (F5)
              </button>
            </div>

            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              style={{
                width: '100%',
                height: '110px',
                fontFamily: 'monospace',
                fontSize: '13px',
                padding: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Log / Message / Error Alert banner */}
          {error && (
            <div
              style={{
                margin: '20px 20px 0',
                padding: '12px 16px',
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 500,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Results Grid */}
          <div
            style={{
              flex: 1,
              padding: '20px',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3
              style={{ fontSize: '13px', fontWeight: 750, color: '#475569', marginBottom: '12px' }}
            >
              Query Results {queryResult && `(${queryResult.rowCount} rows)`}
            </h3>

            {!queryResult ? (
              <div
                style={{
                  flex: 1,
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#64748b',
                }}
              >
                <Database size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  No results to display. Run a query to load data grid.
                </span>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {queryResult.fields.map((f) => (
                        <th
                          key={f.name}
                          style={{
                            padding: '10px 14px',
                            fontWeight: 700,
                            color: '#475569',
                            borderRight: '1px solid #f1f5f9',
                          }}
                        >
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {queryResult.fields.map((f) => {
                          const val = row[f.name];
                          const strVal =
                            val === null
                              ? 'NULL'
                              : typeof val === 'object'
                                ? JSON.stringify(val)
                                : String(val);
                          return (
                            <td
                              key={f.name}
                              style={{
                                padding: '10px 14px',
                                color: val === null ? '#94a3b8' : '#0f172a',
                                fontStyle: val === null ? 'italic' : 'normal',
                                borderRight: '1px solid #f1f5f9',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                maxWidth: '300px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {strVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
