import React, { useState } from 'react';

export default function SQLEditorPanel({ problem, onRun, onSubmit, sqlResult, loading }) {
  const [query, setQuery] = useState('SELECT ');
  const [submitting, setSubmitting] = useState(false);

  const handleRun = async () => { if (onRun) await onRun(query); };
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(query);
      } else if (onRun) {
        await onRun(query);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>🗃️ SQL Editor</span>
        {problem && (
          <span style={{ color: '#F59E0B', fontSize: '12px', fontWeight: 600 }}>
            {problem.difficulty} — {problem.domain?.toUpperCase()}
          </span>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={styles.runBtn} onClick={handleRun} disabled={loading || submitting || !query.trim()}>
            {loading ? '⏳ Running...' : '▶ Run Query'}
          </button>
          <button style={styles.submitBtn} onClick={handleSubmit} disabled={loading || submitting || !query.trim()}>
            {submitting ? '⏳ Submitting...' : 'Submit Query'}
          </button>
        </div>
      </div>

      <div style={styles.body}>
        {/* Schema view */}
        {problem?.schema && (
          <div style={styles.schemaPanel}>
            <div style={styles.schemaTitle}>📊 Schema</div>
            {problem.schema.map(table => (
              <div key={table.name} style={styles.tableCard}>
                <div style={styles.tableName}>{table.name}</div>
                <table style={styles.colTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Column</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns?.map(col => (
                      <tr key={col.name}>
                        <td style={styles.td}>{col.name}</td>
                        <td style={{ ...styles.td, color: '#9CA3AF' }}>{col.type}</td>
                        <td style={styles.td}>
                          {col.primaryKey && <span style={styles.pk}>PK</span>}
                          {col.foreignKey && <span style={styles.fk}>FK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Main panel */}
        <div style={styles.mainPanel}>
          {/* Problem question */}
          {problem && (
            <div style={styles.questionBox}>
              <div style={styles.questionLabel}>Question</div>
              <div style={styles.questionText}>{problem.question}</div>
            </div>
          )}

          {/* SQL textarea */}
          <textarea
            style={styles.sqlEditor}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Write your SQL query here..."
            spellCheck={false}
          />

          {/* Results */}
          {sqlResult && (
            <div style={styles.resultArea}>
              {sqlResult.success ? (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'
                  }}>
                    <span style={{
                      color: sqlResult.isCorrect ? '#10B981' : '#F59E0B', fontWeight: 700
                    }}>
                      {sqlResult.isCorrect ? '✅ Correct!' : '⚠️ Executed — Check result'}
                    </span>
                    <span style={{ color: '#6B7280', fontSize: '12px' }}>
                      {sqlResult.rowCount} row(s) • {sqlResult.executionTimeMs}ms
                    </span>
                  </div>
                  {sqlResult.columns?.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.resultTable}>
                        <thead>
                          <tr>{sqlResult.columns.map(c => (
                            <th key={c} style={styles.resultTh}>{c}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {sqlResult.rows?.slice(0, 20).map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                              {row.map((cell, j) => (
                                <td key={j} style={styles.resultTd}>{String(cell ?? 'NULL')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {sqlResult.rowCount > 20 && (
                        <div style={{ color: '#6B7280', fontSize: '12px', padding: '8px' }}>
                          Showing 20 of {sqlResult.rowCount} rows
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={styles.errorBox}>
                  <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: '4px' }}>Error</div>
                  <pre style={{ color: '#b91c1c', fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {sqlResult.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' },
  header: {
    display: 'flex', alignItems: 'center', gap: '16px',
    padding: '12px 16px', background: '#fafafa',
    borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0,
  },
  title: { color: '#111827', fontWeight: 700, fontSize: '14px', marginRight: 'auto' },
  runBtn: {
    background: '#fffbeb', border: '1px solid #F59E0B', color: '#b45309',
    borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },
  submitBtn: {
    background: '#6B46C1', border: 'none', color: '#fff',
    borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  schemaPanel: {
    width: '220px', overflowY: 'auto', padding: '16px',
    borderRight: '1px solid rgba(0,0,0,0.06)', flexShrink: 0,
  },
  schemaTitle: { color: '#6B7280', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' },
  tableCard: { marginBottom: '16px' },
  tableName: {
    color: '#b45309', fontSize: '12px', fontWeight: 700,
    background: '#fffbeb', padding: '4px 8px', borderRadius: '4px', marginBottom: '6px',
  },
  colTable: { width: '100%', borderCollapse: 'collapse', fontSize: '11px' },
  th: { color: '#9ca3af', padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.06)' },
  td: { color: '#374151', padding: '4px 6px', borderBottom: '1px solid rgba(0,0,0,0.04)' },
  pk: { background: '#F3E8FF', color: '#6B46C1', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' },
  fk: { background: '#fffbeb', color: '#b45309', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' },
  mainPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px', gap: '12px' },
  questionBox: {
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: '10px', padding: '14px', flexShrink: 0,
  },
  questionLabel: { color: '#b45309', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' },
  questionText: { color: '#111827', fontSize: '14px', lineHeight: '1.6' },
  sqlEditor: {
    flex: '0 0 160px',
    background: '#fafafa',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '10px',
    color: '#111827',
    padding: '14px',
    fontSize: '14px',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    resize: 'vertical',
    lineHeight: '1.6',
  },
  resultArea: {
    flex: 1, overflow: 'auto',
    background: '#fafafa',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '10px', padding: '14px',
  },
  resultTable: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  resultTh: {
    color: '#6b7280', padding: '8px 12px', textAlign: 'left',
    borderBottom: '1px solid rgba(0,0,0,0.1)', whiteSpace: 'nowrap',
  },
  resultTd: { color: '#111827', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.04)' },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '8px', padding: '12px',
  },
};
