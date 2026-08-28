import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Database,
  Play,
  AlertCircle,
  Table,
  RefreshCw,
  Layers,
  Terminal,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Search,
  Download,
  History,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { ZohoDeskLogo } from '../components/common/ZohoDeskLogo';

interface QueryResult {
  success: boolean;
  command?: string;
  rowCount?: number;
  fields?: { name: string }[];
  rows?: any[];
  executionTimeMs?: number;
  notices?: string[];
  message?: string;
  statementMessages?: string[];
  error?: string;
  detail?: string;
  hint?: string;
  position?: string;
  executedAt?: string;
  executedSnippet?: string;
}

// Universal clipboard copy with fallback for non-HTTPS and LAN IP addresses
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export const DbExplorerPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Query state & Selection
  const [sql, setSql] = useState('SELECT * FROM "user" LIMIT 20;');
  const [selectedText, setSelectedText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'messages'>('data');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Query History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('db_query_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Results Grid enhancements
  const [gridFilter, setGridFilter] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isGridMaximized, setIsGridMaximized] = useState(false);

  // Cell Value Inspector Modal
  const [inspectCell, setInspectCell] = useState<{
    column: string;
    value: any;
    formatted: string;
  } | null>(null);
  const [copiedCell, setCopiedCell] = useState(false);

  // Text selection tracking (for partial query execution like SSMS / pgAdmin)
  const updateSelection = () => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    if (selectionStart !== selectionEnd) {
      const highlighted = sql.substring(selectionStart, selectionEnd).trim();
      setSelectedText(highlighted);
    } else {
      setSelectedText('');
    }
  };

  const handleConnect = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await ApiClient.get<{ success: boolean; tables?: string[]; error?: string }>(
        '/db-explorer/meta',
      );
      if (res.success) {
        setTables(res.tables || []);
        setIsConnected(true);
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 2000);
      } else {
        setError(res.error || 'Failed to connect to the database.');
        setIsConnected(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error connecting to database.');
      setIsConnected(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveToHistory = (queryStr: string) => {
    const trimmed = queryStr.trim();
    if (!trimmed) return;
    setQueryHistory((prev) => {
      const updated = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 30);
      try {
        localStorage.setItem('db_query_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleExecute = async (overrideSql?: string) => {
    let queryToRun = '';
    let isSnippet = false;

    if (overrideSql) {
      queryToRun = overrideSql.trim();
    } else if (selectedText && selectedText.trim().length > 0) {
      queryToRun = selectedText.trim();
      isSnippet = true;
    } else if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      if (selectionStart !== selectionEnd) {
        const highlighted = sql.substring(selectionStart, selectionEnd).trim();
        if (highlighted) {
          queryToRun = highlighted;
          isSnippet = true;
        }
      }
    }

    if (!queryToRun) queryToRun = sql.trim();
    if (!queryToRun) return;

    setIsExecuting(true);
    setError(null);
    const now = new Date().toLocaleTimeString();
    saveToHistory(queryToRun);

    try {
      const res = await ApiClient.post<QueryResult>('/db-explorer/query', { sql: queryToRun });
      const resultWithMeta: QueryResult = {
        ...res,
        executedAt: now,
        executedSnippet: isSnippet ? queryToRun : undefined,
      };
      setQueryResult(resultWithMeta);

      if (res.success) {
        if (res.rows && res.rows.length > 0) {
          setActiveTab('data');
        } else {
          setActiveTab('messages');
        }
      } else {
        setError(res.error || 'SQL query execution failed.');
        setActiveTab('messages');
      }
    } catch (err: any) {
      const errorResult: QueryResult = {
        success: false,
        error: err.message || 'Error executing SQL query.',
        executedAt: now,
        executedSnippet: isSnippet ? queryToRun : undefined,
      };
      setError(err.message || 'Error executing SQL query.');
      setQueryResult(errorResult);
      setActiveTab('messages');
    } finally {
      setIsExecuting(false);
    }
  };

  // Keyboard shortcut handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
      e.preventDefault();
      handleExecute();
    }
  };

  useEffect(() => {
    handleConnect();
  }, []);

  // Quick Table Actions
  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    const query = `SELECT * FROM "${tableName}" LIMIT 50;`;
    setSql(query);
    setSelectedText('');
  };

  const handleCountTable = (tableName: string) => {
    setSelectedTable(tableName);
    const query = `SELECT count(*) AS total_rows FROM "${tableName}";`;
    setSql(query);
    setSelectedText('');
    handleExecute(query);
  };

  const handleSchemaTable = (tableName: string) => {
    setSelectedTable(tableName);
    const query = `SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = '${tableName}' 
ORDER BY ordinal_position;`;
    setSql(query);
    setSelectedText('');
    handleExecute(query);
  };

  // Filtered tables
  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return tables;
    const query = tableSearch.toLowerCase();
    return tables.filter((t) => t.toLowerCase().includes(query));
  }, [tables, tableSearch]);

  // Safety Check: Destructive query warning on active query text
  const activeQueryText = selectedText.trim() || sql.trim();
  const destructiveWarning = useMemo(() => {
    const s = activeQueryText.toUpperCase();
    const isUpdateOrDelete =
      (s.startsWith('UPDATE') || s.startsWith('DELETE FROM') || s.includes('DELETE FROM')) &&
      !s.includes('WHERE');
    if (isUpdateOrDelete) {
      return 'Caution: Running UPDATE or DELETE without a WHERE clause will modify or delete all rows in the table.';
    }
    return null;
  }, [activeQueryText]);

  // Copy messages
  const copyMessagesToClipboard = async () => {
    if (!queryResult) return;
    const lines = [
      `[${queryResult.executedAt || ''}] Status: ${queryResult.success ? 'SUCCESS' : 'ERROR'}`,
      queryResult.executedSnippet ? `Executed Selection: ${queryResult.executedSnippet}` : '',
      queryResult.command ? `Command: ${queryResult.command}` : '',
      queryResult.rowCount !== undefined ? `Rows affected: ${queryResult.rowCount}` : '',
      queryResult.executionTimeMs !== undefined
        ? `Execution time: ${queryResult.executionTimeMs} ms`
        : '',
      queryResult.message || '',
      ...(queryResult.statementMessages || []).map((m) => `• ${m}`),
      queryResult.error ? `ERROR: ${queryResult.error}` : '',
      queryResult.detail ? `Detail: ${queryResult.detail}` : '',
      queryResult.hint ? `Hint: ${queryResult.hint}` : '',
      ...(queryResult.notices || []).map((n) => `NOTICE: ${n}`),
    ]
      .filter(Boolean)
      .join('\n');

    await copyToClipboard(lines);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!queryResult?.rows || queryResult.rows.length === 0 || !queryResult.fields) return;
    const headers = queryResult.fields.map((f) => `"${f.name.replace(/"/g, '""')}"`).join(',');
    const rows = queryResult.rows.map((row) =>
      queryResult.fields!
        .map((f) => {
          const val = row[f.name];
          if (val === null || val === undefined) return '""';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query_result_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (!queryResult?.rows || queryResult.rows.length === 0) return;
    const jsonStr = JSON.stringify(queryResult.rows, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query_result_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Cell Inspector Opener
  const openCellInspector = (column: string, value: any) => {
    let formatted = 'NULL';
    if (value !== null && value !== undefined) {
      if (typeof value === 'object') {
        try {
          formatted = JSON.stringify(value, null, 2);
        } catch {
          formatted = String(value);
        }
      } else {
        formatted = String(value);
      }
    }
    setInspectCell({ column, value, formatted });
    setCopiedCell(false);
  };

  const handleCopyCell = async () => {
    if (!inspectCell) return;
    await copyToClipboard(inspectCell.formatted);
    setCopiedCell(true);
    setTimeout(() => setCopiedCell(false), 2000);
  };

  // Process rows with client-side sort & filter
  const processedRows = useMemo(() => {
    if (!queryResult?.rows) return [];
    let list = [...queryResult.rows];

    // Filter
    if (gridFilter.trim()) {
      const q = gridFilter.toLowerCase();
      list = list.filter((r) =>
        Object.values(r).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        }),
      );
    }

    // Sort
    if (sortCol) {
      list.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return list;
  }, [queryResult?.rows, gridFilter, sortCol, sortDir]);

  const handleToggleSort = (colName: string) => {
    if (sortCol === colName) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
  };

  const isMutationOrDdl =
    queryResult?.command &&
    ['UPDATE', 'DELETE', 'INSERT', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'].some((cmd) =>
      queryResult.command!.toUpperCase().includes(cmd),
    );

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
          height: '54px',
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
          <ZohoDeskLogo size={26} showText={false} />
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
            Database Explorer
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowHistoryModal(true)}
            style={{
              fontSize: '12px',
              color: '#334155',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <History size={14} />
            <span>History</span>
            {queryHistory.length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'var(--primary-surface)',
                  color: 'var(--primary)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700,
                }}
              >
                {queryHistory.length}
              </span>
            )}
          </button>

          <a
            href="/inbox"
            style={{
              fontSize: '12px',
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

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar (Tables with Search & Quick Actions) */}
        {!isGridMaximized && (
          <div
            style={{
              width: '290px',
              borderRight: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Table Search & Refresh bar */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    left: '9px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search tables..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 28px',
                    fontSize: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                  }}
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: '#94a3b8',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Layers size={13} />
                  Tables ({filteredTables.length}{tableSearch ? ` / ${tables.length}` : ''})
                </span>
                <button
                  onClick={handleConnect}
                  disabled={isRefreshing}
                  title="Refresh table list"
                  style={{
                    border: '1px solid #e2e8f0',
                    backgroundColor: refreshSuccess ? '#dcfce7' : '#ffffff',
                    color: refreshSuccess ? '#166534' : '#64748b',
                    cursor: isRefreshing ? 'wait' : 'pointer',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {refreshSuccess ? (
                    <>
                      <Check size={12} color="#16a34a" />
                      <span>Refreshed</span>
                    </>
                  ) : isRefreshing ? (
                    <>
                      <RefreshCw size={12} className="animate-spin text-primary" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} />
                      <span>Refresh</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tables List */}
            <div style={{ padding: '8px 10px', flex: 1, overflowY: 'auto' }}>
              {filteredTables.length === 0 ? (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    marginTop: '24px',
                  }}
                >
                  {tableSearch ? 'No tables match your search.' : 'No tables loaded.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {filteredTables.map((t) => {
                    const isCurrent = selectedTable === t;
                    return (
                      <div
                        key={t}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          backgroundColor: isCurrent ? 'var(--primary-surface)' : 'transparent',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <button
                          onClick={() => handleSelectTable(t)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            flex: 1,
                            overflow: 'hidden',
                            padding: 0,
                          }}
                        >
                          <Table
                            size={13}
                            color={isCurrent ? 'var(--primary)' : '#64748b'}
                            style={{ flexShrink: 0 }}
                          />
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              color: isCurrent ? 'var(--primary)' : '#334155',
                              fontWeight: isCurrent ? 700 : 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t}
                          </span>
                        </button>

                        {/* Quick hover actions */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            opacity: isCurrent ? 1 : 0.7,
                          }}
                        >
                          <button
                            onClick={() => handleCountTable(t)}
                            title="Count rows"
                            style={{
                              padding: '2px 5px',
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            COUNT
                          </button>
                          <button
                            onClick={() => handleSchemaTable(t)}
                            title="View table schema/columns"
                            style={{
                              padding: '2px 5px',
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            SCHEMA
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Pane (Query Editor & Results Grid) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Query Editor (Light Theme) */}
          {!isGridMaximized && (
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 750, color: '#334155' }}>
                    SQL Query Workspace
                  </label>
                  {selectedText ? (
                    <span
                      style={{
                        fontSize: '11px',
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Sparkles size={11} />
                      Selection Active ({selectedText.length} chars)
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      (Press F5 or Ctrl+Enter to execute full or selected SQL)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setSql('');
                      setSelectedText('');
                    }}
                    disabled={!sql}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: 'transparent',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#64748b',
                      cursor: sql ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Clear
                  </button>

                  <button
                    onClick={() => handleExecute()}
                    disabled={isExecuting || !isConnected}
                    style={{
                      padding: '6px 16px',
                      backgroundColor: selectedText ? '#2563eb' : '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                      opacity: isConnected ? 1 : 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isExecuting ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Play size={13} />
                    )}
                    {selectedText ? 'Execute Selection (F5)' : 'Execute Query (F5)'}
                  </button>
                </div>
              </div>

              {/* Light Themed Monospace SQL Editor */}
              <textarea
                ref={textareaRef}
                value={sql}
                onChange={(e) => {
                  setSql(e.target.value);
                  updateSelection();
                }}
                onSelect={updateSelection}
                onMouseUp={updateSelection}
                onKeyUp={updateSelection}
                onKeyDown={handleKeyDown}
                placeholder="Enter SQL query (e.g. SELECT * FROM &quot;user&quot; LIMIT 20;)"
                style={{
                  width: '100%',
                  height: '150px',
                  minHeight: '110px',
                  maxHeight: '420px',
                  fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                  fontSize: '13px',
                  padding: '12px 14px',
                  border: selectedText ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  resize: 'vertical',
                  lineHeight: 1.5,
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
                }}
              />

              {/* Destructive Warning Badge */}
              {destructiveWarning && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#92400e',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                  <span>{destructiveWarning}</span>
                </div>
              )}
            </div>
          )}

          {/* Log / Message / Error Alert banner if any */}
          {error && (
            <div
              style={{
                margin: '10px 20px 0',
                padding: '10px 14px',
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 500,
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Bottom Tabs & Controls Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              marginTop: error ? '10px' : '0',
            }}
          >
            {/* Left Tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setActiveTab('data')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  backgroundColor: activeTab === 'data' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom:
                    activeTab === 'data' ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: activeTab === 'data' ? 700 : 500,
                  color: activeTab === 'data' ? '#0f172a' : '#64748b',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <Table size={14} />
                <span>Data Output</span>
                {queryResult?.rows && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: activeTab === 'data' ? '#f1f5f9' : '#e2e8f0',
                      color: '#475569',
                      fontWeight: 600,
                    }}
                  >
                    {processedRows.length}
                    {gridFilter ? `/${queryResult.rows.length}` : ''}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('messages')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  backgroundColor: activeTab === 'messages' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom:
                    activeTab === 'messages' ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: activeTab === 'messages' ? 700 : 500,
                  color: activeTab === 'messages' ? '#0f172a' : '#64748b',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <Terminal size={14} />
                <span>Messages</span>
                {queryResult && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: queryResult.success ? '#dcfce7' : '#fee2e2',
                      color: queryResult.success ? '#166534' : '#991b1b',
                      fontWeight: 700,
                    }}
                  >
                    {queryResult.success ? queryResult.command || 'OK' : 'ERR'}
                  </span>
                )}
              </button>
            </div>

            {/* Right Tools (Search, Export, Maximize) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeTab === 'data' && queryResult?.rows && queryResult.rows.length > 0 && (
                <>
                  {/* Grid search input */}
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={12}
                      style={{
                        position: 'absolute',
                        left: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Filter results..."
                      value={gridFilter}
                      onChange={(e) => setGridFilter(e.target.value)}
                      style={{
                        padding: '4px 8px 4px 24px',
                        fontSize: '11px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        width: '140px',
                      }}
                    />
                  </div>

                  {/* Export buttons */}
                  <button
                    onClick={handleExportCSV}
                    title="Export as CSV"
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Download size={12} />
                    CSV
                  </button>

                  <button
                    onClick={handleExportJSON}
                    title="Export as JSON"
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Download size={12} />
                    JSON
                  </button>
                </>
              )}

              {/* Execution duration tag */}
              {queryResult?.executionTimeMs !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  <Clock size={12} />
                  {queryResult.executionTimeMs} ms
                </span>
              )}

              {/* Maximize Grid Toggle */}
              <button
                onClick={() => setIsGridMaximized((prev) => !prev)}
                title={isGridMaximized ? 'Restore View' : 'Maximize Results'}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                {isGridMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Tab Content Area */}
          <div
            style={{
              flex: 1,
              padding: '14px 20px',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
            }}
          >
            {/* 1. DATA OUTPUT TAB */}
            {activeTab === 'data' && (
              <>
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
                ) : queryResult.rows && queryResult.rows.length > 0 && queryResult.fields ? (
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
                        fontSize: '12px',
                        textAlign: 'left',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            position: 'sticky',
                            top: 0,
                            zIndex: 2,
                          }}
                        >
                          <th
                            style={{
                              padding: '8px 10px',
                              fontWeight: 700,
                              color: '#94a3b8',
                              fontSize: '11px',
                              width: '40px',
                              textAlign: 'center',
                              borderRight: '1px solid #f1f5f9',
                            }}
                          >
                            #
                          </th>
                          {queryResult.fields.map((f) => (
                            <th
                              key={f.name}
                              onClick={() => handleToggleSort(f.name)}
                              style={{
                                padding: '8px 12px',
                                fontWeight: 700,
                                color: sortCol === f.name ? 'var(--primary)' : '#475569',
                                borderRight: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                userSelect: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{f.name}</span>
                                {sortCol === f.name ? (
                                  sortDir === 'asc' ? (
                                    <ArrowUp size={12} color="var(--primary)" />
                                  ) : (
                                    <ArrowDown size={12} color="var(--primary)" />
                                  )
                                ) : (
                                  <ArrowUpDown size={11} color="#cbd5e1" />
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {processedRows.map((row, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: idx % 2 === 1 ? '#fafafa' : '#ffffff',
                            }}
                          >
                            <td
                              style={{
                                padding: '6px 10px',
                                color: '#94a3b8',
                                fontSize: '11px',
                                textAlign: 'center',
                                fontFamily: 'monospace',
                                borderRight: '1px solid #f1f5f9',
                                userSelect: 'none',
                              }}
                            >
                              {idx + 1}
                            </td>
                            {queryResult.fields?.map((f) => {
                              const val = row[f.name];
                              const isNull = val === null || val === undefined;
                              const isObj = typeof val === 'object' && !isNull;
                              const strVal = isNull
                                ? 'NULL'
                                : isObj
                                  ? JSON.stringify(val)
                                  : String(val);

                              return (
                                <td
                                  key={f.name}
                                  onClick={() => openCellInspector(f.name, val)}
                                  title="Click to view full cell content"
                                  style={{
                                    padding: '6px 12px',
                                    color: isNull ? '#94a3b8' : isObj ? '#0284c7' : '#0f172a',
                                    fontStyle: isNull ? 'italic' : 'normal',
                                    borderRight: '1px solid #f1f5f9',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    maxWidth: '260px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
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
                ) : (
                  <div
                    style={{
                      flex: 1,
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      padding: '30px',
                      backgroundColor: '#f8fafc',
                      textAlign: 'center',
                    }}
                  >
                    {isMutationOrDdl ? (
                      <>
                        <CheckCircle2
                          size={40}
                          style={{ color: '#059669', marginBottom: '12px' }}
                        />
                        <h4
                          style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#0f172a',
                            margin: '0 0 6px',
                          }}
                        >
                          Query Executed Successfully
                        </h4>
                        <p
                          style={{
                            fontSize: '13px',
                            color: '#64748b',
                            maxWidth: '480px',
                            margin: '0 0 16px',
                          }}
                        >
                          {queryResult.command} completed in {queryResult.executionTimeMs} ms
                          affecting <strong>{queryResult.rowCount ?? 0} row(s)</strong>. Check the
                          Messages tab for complete details.
                        </p>
                        <button
                          onClick={() => setActiveTab('messages')}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          View Execution Logs in Messages
                        </button>
                      </>
                    ) : (
                      <>
                        <Database size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                          {queryResult.success
                            ? 'Query returned 0 rows.'
                            : 'No data returned due to execution error.'}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 2. MESSAGES TAB */}
            {activeTab === 'messages' && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  border: '1px solid #1e293b',
                  overflow: 'hidden',
                }}
              >
                {/* Console header */}
                <div
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1e293b',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={14} color="#94a3b8" />
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#cbd5e1',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      Output Messages & Notices
                    </span>
                  </div>
                  {queryResult && (
                    <button
                      onClick={copyMessagesToClipboard}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        backgroundColor: copiedLogs
                          ? 'rgba(52, 211, 153, 0.2)'
                          : 'rgba(255, 255, 255, 0.08)',
                        border: copiedLogs
                          ? '1px solid #34d399'
                          : '1px solid rgba(255, 255, 255, 0.15)',
                        color: copiedLogs ? '#34d399' : '#cbd5e1',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedLogs ? <Check size={13} /> : <Copy size={13} />}
                      {copiedLogs ? 'Copied!' : 'Copy Logs'}
                    </button>
                  )}
                </div>

                {/* Console Body */}
                <div
                  style={{
                    flex: 1,
                    padding: '16px',
                    fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    overflowY: 'auto',
                    color: '#f8fafc',
                  }}
                >
                  {!queryResult ? (
                    <span style={{ color: '#64748b' }}>
                      Ready. Execute a SQL query to see console messages and logs.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {queryResult.executedSnippet && (
                        <div
                          style={{
                            padding: '6px 10px',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            borderLeft: '3px solid #3b82f6',
                            borderRadius: '4px',
                            color: '#93c5fd',
                            fontSize: '12px',
                            marginBottom: '6px',
                          }}
                        >
                          <strong>[Executed Selection]:</strong> {queryResult.executedSnippet}
                        </div>
                      )}

                      {queryResult.success ? (
                        <>
                          <div style={{ color: '#34d399', fontWeight: 600 }}>
                            -- Query returned successfully in {queryResult.executionTimeMs} ms.
                          </div>

                          {queryResult.statementMessages &&
                          queryResult.statementMessages.length > 1 ? (
                            queryResult.statementMessages.map((stmtMsg, idx) => (
                              <div key={idx} style={{ color: '#f8fafc' }}>
                                • {stmtMsg}
                              </div>
                            ))
                          ) : (
                            <>
                              <div style={{ color: '#f8fafc' }}>
                                {queryResult.command}{' '}
                                {typeof queryResult.rowCount === 'number' && queryResult.rowCount}
                              </div>
                              {typeof queryResult.rowCount === 'number' && (
                                <div style={{ color: '#94a3b8' }}>
                                  ({queryResult.rowCount} row
                                  {queryResult.rowCount === 1 ? '' : 's'} affected)
                                </div>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ color: '#f87171', fontWeight: 700 }}>
                            ERROR: {queryResult.error}
                          </div>
                          {queryResult.detail && (
                            <div style={{ color: '#fca5a5' }}>DETAIL: {queryResult.detail}</div>
                          )}
                          {queryResult.hint && (
                            <div style={{ color: '#fef08a' }}>HINT: {queryResult.hint}</div>
                          )}
                          {queryResult.position && (
                            <div style={{ color: '#cbd5e1' }}>
                              LINE / POSITION: {queryResult.position}
                            </div>
                          )}
                        </>
                      )}

                      {queryResult.notices && queryResult.notices.length > 0 && (
                        <div
                          style={{
                            marginTop: '8px',
                            borderTop: '1px dashed #334155',
                            paddingTop: '8px',
                          }}
                        >
                          {queryResult.notices.map((notice, idx) => (
                            <div key={idx} style={{ color: '#fbbf24' }}>
                              NOTICE: {notice}
                            </div>
                          ))}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '8px',
                          borderTop: '1px solid #1e293b',
                          fontSize: '11px',
                          color: '#64748b',
                        }}
                      >
                        Execution timestamp:{' '}
                        {queryResult.executedAt || new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cell Inspector Modal */}
      {inspectCell && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setInspectCell(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              width: '600px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} color="var(--primary)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Cell Inspector: <code style={{ color: 'var(--primary)' }}>{inspectCell.column}</code>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={handleCopyCell}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: copiedCell ? '#16a34a' : '#334155',
                  }}
                >
                  {copiedCell ? <Check size={12} /> : <Copy size={12} />}
                  {copiedCell ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setInspectCell(null)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div
              style={{
                padding: '16px',
                overflowY: 'auto',
                flex: 1,
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {inspectCell.formatted}
            </div>
          </div>
        </div>
      )}

      {/* Query History Modal */}
      {showHistoryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              width: '680px',
              maxWidth: '92vw',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} color="var(--primary)" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  Query History
                </span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                    Recent Query History ({queryHistory.length})
                  </h4>
                  {queryHistory.length > 0 && (
                    <button
                      onClick={() => {
                        setQueryHistory([]);
                        localStorage.removeItem('db_query_history');
                      }}
                      style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        fontSize: '11px',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Trash2 size={12} />
                      Clear History
                    </button>
                  )}
                </div>

                {queryHistory.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>
                    No queries executed in this session yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {queryHistory.map((hSql, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: '#334155',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '480px',
                          }}
                        >
                          {hSql}
                        </span>
                        <button
                          onClick={() => {
                            setSql(hSql);
                            setSelectedText('');
                            setShowHistoryModal(false);
                          }}
                          style={{
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            color: '#334155',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
