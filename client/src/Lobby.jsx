import { useState, useEffect } from 'react';
import { API_BASE } from './config';

function Lobby({ onEnterRoom, onInvalidToken }) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [testCases, setTestCases] = useState([
    { input: '', expectedOutput: '', isHidden: false },
  ]);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions/mine`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('token');
          onInvalidToken();
          return;
        }

        const data = await res.json();
        if (res.ok) setHistory(data.sessions);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []);

  const addTestCase = () => {
    setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }]);
  };

  const removeTestCase = (index) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index, field, value) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const createSession = async () => {
    setError('');

    if (!title.trim() || !description.trim()) {
      setError('Please add a title and description');
      return;
    }
    const validTestCases = testCases.filter((tc) => tc.expectedOutput.trim());
    if (validTestCases.length === 0) {
      setError('Add at least one test case with an expected output');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ title, description, testCases: validTestCases }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to create session');
        setCreating(false);
        return;
      }

      onEnterRoom(data.roomId);
    } catch (err) {
      setError('Could not reach server');
      setCreating(false);
    }
  };

  const joinSession = () => {
    if (!joinRoomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    onEnterRoom(joinRoomId.trim());
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="fixed inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top nav */}
      <div className="relative border-b border-neutral-800/80 bg-neutral-950/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="font-mono font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            CODE_INTERVIEW
          </h1>
          <button
            onClick={handleLogout}
            className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors font-mono"
          >
            Log Out
          </button>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-3xl font-bold text-white mb-1">Start a Session</h2>
        <p className="text-neutral-500 text-sm font-mono">
          <span className="text-green-400">●</span> Ready — create a new interview or join an existing one
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Left: actions + history */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-neutral-800/80 p-6">
              {!showCreateForm ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-white font-medium mb-1">Start an Interview</h3>
                    <p className="text-neutral-500 text-xs mb-3">
                      Host a new technical session for a candidate.
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 transition-all text-white font-medium rounded-lg py-2.5 shadow-lg shadow-purple-600/20"
                    >
                      + Create New Session
                    </button>
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Join a Session</h3>
                    <p className="text-neutral-500 text-xs mb-3">
                      Enter a room ID to join an existing session.
                    </p>
                    <div className="flex gap-2">
                      <input
                        placeholder="SESSION_ID"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value)}
                        className="flex-1 bg-neutral-900 text-white placeholder-neutral-600 rounded-lg px-4 py-2.5 outline-none border border-neutral-800 focus:border-blue-500/50 transition-all font-mono text-sm"
                      />
                      <button
                        onClick={joinSession}
                        className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors text-white rounded-lg px-4"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium">New Problem</p>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="text-neutral-500 hover:text-neutral-300 text-sm font-mono"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-1.5 block">
                      Title
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Reverse a String"
                      className="w-full bg-neutral-900 text-white placeholder-neutral-600 rounded-lg px-4 py-2.5 outline-none border border-neutral-800 focus:border-blue-500/50 transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-1.5 block">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Explain the problem, input format, constraints..."
                      rows={4}
                      className="w-full bg-neutral-900 text-white placeholder-neutral-600 rounded-lg px-4 py-2.5 outline-none border border-neutral-800 focus:border-blue-500/50 transition-all text-sm resize-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-neutral-500 text-xs font-mono uppercase tracking-wider">
                        Test Cases
                      </label>
                      <button
                        onClick={addTestCase}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium font-mono"
                      >
                        + Add
                      </button>
                    </div>

                    <div className="space-y-3">
                      {testCases.map((tc, i) => (
                        <div key={i} className="bg-neutral-800/40 border border-neutral-800 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500 text-xs font-mono">Case {i + 1}</span>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-neutral-500 text-xs cursor-pointer font-mono">
                                <input
                                  type="checkbox"
                                  checked={tc.isHidden}
                                  onChange={(e) => updateTestCase(i, 'isHidden', e.target.checked)}
                                  className="accent-blue-500"
                                />
                                Hidden
                              </label>
                              {testCases.length > 1 && (
                                <button
                                  onClick={() => removeTestCase(i)}
                                  className="text-neutral-600 hover:text-red-400 text-xs font-mono"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                          <input
                            value={tc.input}
                            onChange={(e) => updateTestCase(i, 'input', e.target.value)}
                            placeholder="e.g. 5 (raw value passed via stdin)"
                            className="w-full bg-neutral-900 text-white placeholder-neutral-600 rounded-md px-3 py-1.5 outline-none border border-neutral-800 focus:border-blue-500/50 text-xs font-mono"
                          />
                          <input
                            value={tc.expectedOutput}
                            onChange={(e) => updateTestCase(i, 'expectedOutput', e.target.value)}
                            placeholder="Expected output"
                            className="w-full bg-neutral-900 text-white placeholder-neutral-600 rounded-md px-3 py-1.5 outline-none border border-neutral-800 focus:border-blue-500/50 text-xs font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={createSession}
                    disabled={creating}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 disabled:opacity-60 transition-all text-white font-medium rounded-lg py-2.5 shadow-lg shadow-purple-600/20"
                  >
                    {creating ? 'Creating...' : 'Create Session'}
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-4">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}
            </div>

            {/* Session history */}
            <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-neutral-800/80 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-800">
                <p className="text-white text-sm font-medium font-mono">Your Sessions</p>
              </div>
              {loadingHistory ? (
                <p className="text-neutral-600 text-sm text-center py-8 font-mono">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-neutral-600 text-sm text-center py-8 font-mono">No sessions yet</p>
              ) : (
                <div className="divide-y divide-neutral-800 max-h-80 overflow-y-auto">
                  {history.map((s) => (
                    <button
                      key={s.roomId}
                      onClick={() => onEnterRoom(s.roomId)}
                      className="w-full text-left px-6 py-4 hover:bg-neutral-800/40 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                              s.status === 'completed'
                                ? 'bg-neutral-700/50 text-neutral-400'
                                : 'bg-green-500/15 text-green-400'
                            }`}
                          >
                            {s.status === 'completed' ? 'Archived' : 'Active'}
                          </span>
                          <p className="text-white text-sm">{s.title}</p>
                        </div>
                        <p className="text-neutral-500 text-xs mt-1 font-mono">
                          {s.role === 'interviewer' ? 'Interviewer' : 'Candidate'} ·{' '}
                          {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-blue-400 text-xs font-mono">
                        {s.status === 'completed' ? 'View →' : 'Resume →'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: platform info (real, not fake live stats) */}
          <div className="space-y-4">
            <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-green-500/20 p-5">
              <p className="text-green-400 text-xs font-mono uppercase tracking-wider mb-3">Platform</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-neutral-300 text-sm">Real-time collaborative editor</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-neutral-300 text-sm">Sandboxed code execution</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-neutral-300 text-sm">Role-based test case visibility</p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-neutral-800/80 p-5">
              <p className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-2">Languages</p>
              <div className="flex gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-neutral-800 text-neutral-300">JavaScript</span>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-neutral-800 text-neutral-300">Python</span>
              </div>
            </div>

            <p className="text-center text-neutral-700 text-xs font-mono">v1.0.0-stable</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lobby;