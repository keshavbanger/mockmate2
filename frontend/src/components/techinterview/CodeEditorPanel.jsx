import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

// C++/Go can't be generically graded (see CodeExecutionService — no
// per-problem type metadata to marshal function args for a language with no
// runtime reflection), so every submission in either fails every test case
// regardless of correctness. They stay selectable since Run/Console mode
// still works, but the label makes that limitation visible up front instead
// of the candidate discovering it only after writing a full solution.
const LANG_OPTS = [
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'go', label: 'Go' },
];

const MONACO_LANG = { java: 'java', python: 'python', cpp: 'cpp', javascript: 'javascript', go: 'go' };

const getDefaultCode = (lang) => {
  switch (lang) {
    case 'java': return '// Write your Java solution here\n';
    case 'python': return '# Write your Python solution here\n';
    case 'cpp': return '// Write your C++ solution here\n';
    case 'javascript': return '// Write your JavaScript solution here\n';
    case 'go': return '// Write your Go solution here\n';
    default: return '// Write your solution here\n';
  }
};

export default function CodeEditorPanel({ problem, language, onLanguageChange, onRun, onSubmit, onRunConsole, codeResult, consoleResult, consoleLoading, loading }) {
  const [code, setCode] = useState(
    problem?.starterCode?.[language] || getDefaultCode(language)
  );
  const [activeTab, setActiveTab] = useState('problem'); // 'problem' | 'results' | 'console'
  const [submitting, setSubmitting] = useState(false);
  const [customInput, setCustomInput] = useState('');

  // Backend Bug 6 fix: the AI can re-send editorConfig.loadProblem=true for
  // the SAME problem that's already open (e.g. on a plain follow-up/hint
  // turn) — that makes the parent refetch and pass down a brand-new
  // `problem` object even though nothing actually changed. This effect used
  // to key off `problem` itself, so that reference change alone reset
  // `code` back to starter code, silently wiping whatever the candidate had
  // already typed. Key off the problem's real ID instead, so only an
  // actual problem change resets the editor.
  const prevProblemIdRef = useRef(problem?.id);
  useEffect(() => {
    const isNewProblem = problem?.id !== prevProblemIdRef.current;
    prevProblemIdRef.current = problem?.id;
    if (!isNewProblem) return;
    if (problem?.starterCode?.[language]) {
      setCode(problem.starterCode[language]);
    } else {
      setCode(getDefaultCode(language));
    }
  }, [problem, language]);

  const handleLanguageChange = (lang) => {
    onLanguageChange(lang);
    if (problem?.starterCode?.[lang]) {
      setCode(problem.starterCode[lang]);
    } else {
      setCode(getDefaultCode(lang));
    }
  };

  const handleRun = async () => {
    if (onRun) {
      await onRun(code, language);
      setActiveTab('results');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(code, language);
      } else if (onRun) {
        await onRun(code, language);
      }
      setActiveTab('results');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunConsole = async () => {
    if (onRunConsole) {
      await onRunConsole(code, language, customInput);
    }
  };

  const difficultyColor = d => ({ EASY: '#10B981', MEDIUM: '#F59E0B', HARD: '#EF4444' }[d] || '#6B7280');

  const hasTestCases = (codeResult?.totalTestCases || 0) > 0;
  // codeResult?.success === false covers backend-level failures (problem not
  // found, execution service error) that previously fell through both branches
  // here and rendered as a false "success" banner with no test cases and no
  // error shown, since neither hasTestCases nor compilationError were set.
  const hasError = codeResult?.success === false || !!codeResult?.compilationError || !!codeResult?.pistonError;
  const isSuccess = hasError ? false : (hasTestCases ? codeResult?.allPassed : true);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.tabs}>
          {['problem', 'results', 'console'].map(tab => (
            <button key={tab} style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(tab)}>
              {tab === 'problem' ? (problem ? '📋 Problem' : '💻 Editor') : tab === 'results' ? '✅ Results' : '⌨️ Console'}
              {tab === 'results' && codeResult && (
                <span style={{
                  ...styles.resultBadge,
                  background: isSuccess ? '#10B98122' : '#EF444422',
                  color: isSuccess ? '#10B981' : '#EF4444',
                }}>
                  {hasTestCases
                    ? `${codeResult.testCasesPassed}/${codeResult.totalTestCases}`
                    : (codeResult.compilationError ? 'Error' : (codeResult.isSubmitted ? 'Submitted' : 'Executed'))}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={styles.controls}>
          <select style={styles.langSelect} value={language} onChange={e => handleLanguageChange(e.target.value)}>
            {LANG_OPTS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button style={styles.runBtn} onClick={handleRun} disabled={loading || submitting}>
            {loading ? '⏳' : '▶ Run'}
          </button>
          <button style={styles.submitBtn} onClick={handleSubmit} disabled={loading || submitting}>
            {submitting ? '⏳ Submitting...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* Problem Panel / Scratchpad */}
      {activeTab === 'problem' && (
        problem ? (
          <div style={styles.problemPanel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h2 style={styles.problemTitle}>{problem.title}</h2>
              <span style={{ ...styles.diffBadge, color: difficultyColor(problem.difficulty),
                background: `${difficultyColor(problem.difficulty)}22` }}>
                {problem.difficulty}
              </span>
              {problem.leetcodeId && (
                <a href={problem.leetcodeUrl} target="_blank" rel="noreferrer"
                  style={styles.lcLink}>LC #{problem.leetcodeId}</a>
              )}
            </div>

            <div style={styles.descText}>{problem.description}</div>

            {problem.examples?.map((ex, i) => (
              <div key={i} style={styles.exampleBox}>
                <div style={styles.exampleLabel}>Example {i + 1}</div>
                <div style={styles.exampleCode}>
                  <div><strong>Input:</strong> {ex.input}</div>
                  <div><strong>Output:</strong> {ex.output}</div>
                  {ex.explanation && <div style={{ marginTop: '4px', color: '#9CA3AF' }}>
                    <strong>Explanation:</strong> {ex.explanation}
                  </div>}
                </div>
              </div>
            ))}

            {problem.constraints?.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={styles.sectionTitle}>Constraints</div>
                <ul style={styles.constraintList}>
                  {problem.constraints.map((c, i) => (
                    <li key={i} style={{ color: '#9CA3AF', fontSize: '13px' }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.problemPanel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '20px' }}>💻</span>
              <h3 style={styles.problemTitle}>Code Scratchpad / Quick Snippet</h3>
            </div>
            <div style={styles.descText}>
              Write your code solution or snippet in the editor below. Click <strong>Submit</strong> or <strong>Run</strong> when ready to send your response to the AI Interviewer.
            </div>
          </div>
        )
      )}

      {/* Results Panel */}
      {activeTab === 'results' && codeResult && (
        <div style={styles.resultsPanel}>
          <div style={{
            ...styles.resultSummary,
            background: isSuccess ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            borderColor: isSuccess ? '#10B981' : '#EF4444',
          }}>
            <span style={{ fontSize: '24px' }}>{isSuccess ? '✅' : '❌'}</span>
            <div>
              <div style={{ color: isSuccess ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                {hasTestCases
                  ? `${codeResult.testCasesPassed}/${codeResult.totalTestCases} Test Cases Passed`
                  : (codeResult.compilationError
                      ? 'Execution Failed'
                      : (codeResult.isSubmitted ? 'Code Executed & Submitted to Interviewer' : 'Code Executed in Sandbox'))}
              </div>
              {codeResult.executionTimeMs > 0 && (
                <div style={{ color: '#6B7280', fontSize: '12px' }}>
                  Runtime: {codeResult.executionTimeMs}ms
                </div>
              )}
            </div>
          </div>

          {/* Compile/execution-level error — shown before per-test detail since
              it applies to the whole submission, not one test case */}
          {codeResult.compilationError && (
            <div style={styles.errorBox}>
              <div style={{ color: '#EF4444', fontWeight: 600, marginBottom: '6px' }}>
                {codeResult.compilationError.startsWith('Could not load')
                  ? '⚠️ Could Not Run'
                  : '🛑 Compilation Error'}
              </div>
              <pre style={{ color: '#FCA5A5', fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{codeResult.compilationError}</pre>
            </div>
          )}

          {hasTestCases && codeResult.results?.map((r, i) => (
            <div key={i} style={{ ...styles.testCase, borderColor: r.passed ? '#10B98133' : '#EF444433' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF', fontSize: '13px' }}>
                  Test {i + 1} {r.isHidden ? '(Hidden)' : ''}
                </span>
                <span style={{ color: r.passed ? '#10B981' : '#EF4444', fontWeight: 600, fontSize: '13px' }}>
                  {r.passed ? '✓ Passed' : (r.compileError ? '✗ Compile Error' : '✗ Failed')}
                </span>
              </div>
              {!r.isHidden && !r.compileError && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B7280' }}>
                  <div>Input: <code style={styles.code}>{r.input}</code></div>
                  <div>Expected: <code style={styles.code}>{r.expectedOutput}</code></div>
                  {/* Terminal/output area — this used to only render when a test
                      FAILED, so a passing run never showed you what your code
                      actually printed. Always show it now. */}
                  <div>
                    Output:{' '}
                    <code style={{ ...styles.code, color: r.passed ? '#9CA3AF' : '#EF4444' }}>
                      {r.actualOutput || '(no output)'}
                    </code>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Console Panel — run current code against arbitrary input, separate
          from the fixed test cases in Results. There was previously no way
          to try ad hoc input at all; Run/Submit only ever replayed the
          problem's built-in test cases. */}
      {activeTab === 'console' && (
        <div style={styles.resultsPanel}>
          <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '8px' }}>
            Custom Input <span style={{ color: '#4B5563' }}>(one argument per line, same format as the test cases — e.g. an array as [1,2,3])</span>
          </div>
          <textarea
            style={styles.consoleInput}
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            placeholder={'[2,7,11,15]\n9'}
            spellCheck={false}
          />
          <button style={styles.consoleRunBtn} onClick={handleRunConsole} disabled={consoleLoading}>
            {consoleLoading ? '⏳ Running...' : '▶ Run in Console'}
          </button>

          {consoleResult && (
            <div style={{ marginTop: '14px' }}>
              {consoleResult.compilationError ? (
                <div style={styles.errorBox}>
                  <div style={{ color: '#EF4444', fontWeight: 600, marginBottom: '6px' }}>
                    {consoleResult.compilationError.includes('not supported yet') ? '⚠️ Unsupported Language' : '🛑 Error'}
                  </div>
                  <pre style={{ color: '#FCA5A5', fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{consoleResult.compilationError}</pre>
                </div>
              ) : (
                <div>
                  <div style={{ color: '#6B7280', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }}>Output</div>
                  <pre style={styles.consoleOutput}>{consoleResult.stdout || '(no output)'}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Monaco Editor */}
      <div style={styles.editorArea}>
        <Editor
          height="100%"
          language={MONACO_LANG[language] || 'java'}
          value={code}
          onChange={setCode}
          theme="light"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 16 },
            suggestOnTriggerCharacters: true,
          }}
        />
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 16px', background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)',
    flexShrink: 0,
  },
  tabs: { display: 'flex', gap: '0' },
  tab: {
    background: 'none', border: 'none', color: '#6B7280', fontSize: '13px', fontWeight: 600,
    padding: '14px 16px', cursor: 'pointer', borderBottom: '2px solid transparent',
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  tabActive: { color: '#6B46C1', borderBottomColor: '#6B46C1' },
  resultBadge: { padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 },
  controls: { display: 'flex', gap: '8px', alignItems: 'center' },
  langSelect: {
    background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '6px', color: '#374151', padding: '6px 10px', fontSize: '12px', cursor: 'pointer',
  },
  runBtn: {
    background: '#ecfdf5', border: '1px solid #10B981', color: '#059669',
    borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
  submitBtn: {
    background: '#6B46C1', border: 'none', color: '#fff',
    borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
  },
  problemPanel: { padding: '20px', overflowY: 'auto', flexShrink: 0, maxHeight: '45%' },
  resultsPanel: { padding: '16px', overflowY: 'auto', flexShrink: 0, maxHeight: '40%' },
  editorArea: { flex: 1, overflow: 'hidden' },
  problemTitle: { color: '#111827', fontSize: '16px', fontWeight: 700, margin: 0 },
  diffBadge: { padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 },
  lcLink: { color: '#6B46C1', fontSize: '12px', textDecoration: 'none' },
  descText: { color: '#374151', fontSize: '14px', lineHeight: '1.7', marginBottom: '16px' },
  exampleBox: { background: '#fafafa', borderRadius: '8px', padding: '12px', marginBottom: '10px' },
  exampleLabel: { color: '#6B7280', fontSize: '12px', fontWeight: 700, marginBottom: '8px' },
  exampleCode: { fontFamily: 'monospace', fontSize: '13px', color: '#374151', lineHeight: '1.6' },
  sectionTitle: { color: '#6B7280', fontSize: '12px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' },
  constraintList: { paddingLeft: '20px', margin: 0 },
  resultSummary: {
    display: 'flex', alignItems: 'center', gap: '16px',
    padding: '16px', borderRadius: '12px', border: '1px solid', marginBottom: '16px',
  },
  testCase: {
    background: '#fafafa', border: '1px solid',
    borderRadius: '8px', padding: '12px', marginBottom: '8px',
  },
  code: {
    background: 'rgba(0,0,0,0.05)', padding: '2px 6px',
    borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#111827',
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '8px', padding: '12px',
  },
  consoleInput: {
    width: '100%', minHeight: '90px', resize: 'vertical',
    background: '#fafafa', border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '8px', color: '#111827', padding: '10px 12px',
    fontSize: '13px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", lineHeight: '1.6',
    boxSizing: 'border-box',
  },
  consoleRunBtn: {
    marginTop: '10px', background: '#eff6ff', border: '1px solid #3B82F6',
    color: '#2563eb', borderRadius: '6px', padding: '8px 16px', fontSize: '12px',
    fontWeight: 700, cursor: 'pointer',
  },
  consoleOutput: {
    background: '#fafafa', borderRadius: '8px', padding: '12px',
    color: '#111827', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
    margin: 0, minHeight: '40px',
  },
};
