import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import MonacoEditor from "@monaco-editor/react";
import { API_BASE } from './config';

const LANGUAGE_DEFAULTS = {
  javascript: "// Start typing code here",
  python: "# Start typing code here",
};

const LANGUAGE_EXT = { javascript: "solution.js", python: "solution.py" };

function Editor({ roomId, onLogout, onLeaveRoom }) {
  const [code, setCode] = useState(LANGUAGE_DEFAULTS.javascript);
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("");
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [activePanel, setActivePanel] = useState("problem"); // 'problem' | 'chat' | 'participants' | null
  const [remoteCursors, setRemoteCursors] = useState({});
  const [role, setRole] = useState(null);
  const [problem, setProblem] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("active");
  const debounceTimer = useRef(null);
  const isRemoteChange = useRef(false);
  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const lastCursorSent = useRef(0);
  const codeRef = useRef(code);
  const languageRef = useRef(language);

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { languageRef.current = language; }, [language]);

  useEffect(() => {
    const socket = io(API_BASE, {
      auth: { token: localStorage.getItem("token") },
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("Socket connection failed:", err.message);
      if (err.message.includes("Authentication")) {
        localStorage.removeItem("token");
        onLogout();
      }
    });

    socket.emit("join-room", roomId);

    socket.on("session-info", ({ role, problem, status }) => {
      setRole(role);
      setProblem(problem || null);
      if (status) setSessionStatus(status);
    });

    socket.on("join-error", ({ message }) => {
      alert(message || "You are not authorized to join this session.");
      onLeaveRoom();
    });

    socket.on("receive-code-change", (newCode) => {
      isRemoteChange.current = true;
      setCode(newCode);
    });

    socket.on("load-code", (savedCode) => {
      isRemoteChange.current = true;
      setCode(savedCode);
    });

    socket.on("receive-language-change", (newLanguage) => {
      const prevLanguage = languageRef.current;
      const isUntouched =
        !codeRef.current.trim() || codeRef.current === LANGUAGE_DEFAULTS[prevLanguage];
      setLanguage(newLanguage);
      if (isUntouched) {
        isRemoteChange.current = true;
        setCode(LANGUAGE_DEFAULTS[newLanguage]);
      }
    });

    socket.on("code-result", (result) => {
      setIsRunning(false);
      if (result.mode === "testcases") {
        setTestResults(result);
        setOutput("");
      } else {
        setTestResults(null);
        setOutput(result.success ? result.output : `Error: ${result.output}`);
      }
    });

    socket.on("room-users", (userList) => setUsers(userList));
    socket.on("receive-message", (msg) => setMessages((prev) => [...prev, msg]));

    socket.on("receive-cursor", ({ userId, userName, position }) => {
      setRemoteCursors((prev) => ({ ...prev, [userId]: { userName, position } }));
    });

    socket.on("user-left", ({ userId }) => {
      setRemoteCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on("interview-ended", () => {
      alert("This interview has been marked as completed by the interviewer.");
      onLeaveRoom();
    });

    socket.on("interview-ended-self", () => setSessionStatus("completed"));

    return () => socket.disconnect();
  }, []);

  const decorationsRef = useRef([]);

  useEffect(() => {
    if (!editorRef.current) return;
    const monaco = editorRef.current;
    const newDecorations = Object.entries(remoteCursors).map(([userId, { userName, position }]) => ({
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      options: {
        className: 'remote-cursor',
        hoverMessage: { value: userName },
        before: { content: '', inlineClassName: 'remote-cursor' },
      },
    }));
    decorationsRef.current = monaco.deltaDecorations(decorationsRef.current, newDecorations);
  }, [remoteCursors]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      const now = Date.now();
      if (now - lastCursorSent.current < 50) return;
      lastCursorSent.current = now;
      socketRef.current.emit("cursor-move", {
        room: roomId,
        position: { lineNumber: e.position.lineNumber, column: e.position.column },
      });
    });
  };

  const handleEditorChange = (value) => {
    setCode(value);
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      socketRef.current.emit("send-code-change", { room: roomId, code: value });
    }, 300);
  };

  const handleLanguageChange = (newLanguage) => {
    const isUntouched = !code.trim() || code === LANGUAGE_DEFAULTS[language];
    setLanguage(newLanguage);
    if (isUntouched) {
      const newDefault = LANGUAGE_DEFAULTS[newLanguage];
      setCode(newDefault);
      socketRef.current.emit("send-code-change", { room: roomId, code: newDefault });
    }
    socketRef.current.emit("send-language-change", { room: roomId, language: newLanguage });
  };

  const runCode = () => {
    setIsRunning(true);
    setOutput("Running...");
    setTestResults(null);
    socketRef.current.emit("run-code", { room: roomId, code, language });
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    socketRef.current.emit("send-message", { room: roomId, message: chatInput });
    setChatInput("");
  };

  const endInterview = () => {
    if (!window.confirm("End this interview for the candidate? You'll stay in the room to review.")) return;
    socketRef.current.emit("end-interview", { room: roomId });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    onLogout();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const togglePanel = (panel) => setActivePanel((prev) => (prev === panel ? null : panel));

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-950 border-b border-neutral-800/80">
        <span className="font-mono font-bold text-sm bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mr-2">
          CODE_INTERVIEW
        </span>

        <button
          onClick={runCode}
          disabled={isRunning}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 disabled:opacity-60 transition-all text-white text-sm font-medium rounded-lg px-4 py-1.5 shadow-lg shadow-purple-600/20"
        >
          {isRunning ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Running
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Run Code
            </>
          )}
        </button>

        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-sm rounded-lg px-3 py-1.5 outline-none cursor-pointer font-mono"
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>

        <button
          onClick={copyRoomId}
          className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors text-neutral-300 text-sm rounded-lg px-3 py-1.5"
        >
          <span className="font-mono text-neutral-500 text-xs">{roomId}</span>
          <span className="text-xs text-blue-400 font-medium">{copied ? "Copied!" : "Copy"}</span>
        </button>

        {role && (
          <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-full ${
            role === 'interviewer' ? 'bg-purple-500/15 text-purple-300' : 'bg-blue-500/15 text-blue-300'
          }`}>
            {role.toUpperCase()}
          </span>
        )}

        {sessionStatus === 'completed' && (
          <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400">
            COMPLETED
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto mr-2">
          {users.map((name, i) => (
            <div
              key={i}
              title={name}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold border-2 border-neutral-950"
              style={{ marginLeft: i > 0 ? "-8px" : "0" }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>

        {role === 'interviewer' && sessionStatus !== 'completed' && (
          <button onClick={endInterview} className="text-red-400/80 hover:text-red-400 text-sm transition-colors font-mono">
            End Interview
          </button>
        )}
        <button onClick={onLeaveRoom} className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors font-mono">
          Leave
        </button>
        <button onClick={handleLogout} className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors font-mono">
          Log Out
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Activity rail */}
        <div className="w-14 bg-neutral-950 border-r border-neutral-800/80 flex flex-col items-center py-4 gap-2">
          <button
            onClick={() => togglePanel('problem')}
            title="Problem"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activePanel === 'problem' ? 'bg-blue-500/15 text-blue-400' : 'text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </button>
          <button
            onClick={() => togglePanel('chat')}
            title="Chat"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activePanel === 'chat' ? 'bg-blue-500/15 text-blue-400' : 'text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.17 0-2.29-.2-3.32-.56L3 21l1.6-4.8C3.6 14.94 3 13.52 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {messages.length > 0 && (
              <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => togglePanel('participants')}
            title="Participants"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activePanel === 'participants' ? 'bg-blue-500/15 text-blue-400' : 'text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
          </button>
        </div>

        {/* Side panel content */}
        {activePanel === 'problem' && problem && (
          <div className="w-80 bg-neutral-950 border-r border-neutral-800/80 flex flex-col overflow-y-auto px-5 py-4">
            <p className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-2">Problem</p>
            <p className="text-white font-semibold mb-2">{problem.title}</p>
            <p className="text-neutral-400 text-sm whitespace-pre-wrap leading-relaxed mb-4">{problem.description}</p>
            {problem.testCases && problem.testCases.some((tc) => !tc.isHidden) && (
              <div>
                <p className="text-neutral-600 text-xs font-mono uppercase tracking-wider mb-2">
                  Example{problem.testCases.filter((tc) => !tc.isHidden).length > 1 ? "s" : ""}
                </p>
                <div className="space-y-2">
                  {problem.testCases.filter((tc) => !tc.isHidden).map((tc, i) => (
                    <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                      {tc.input && <p className="text-neutral-500 text-xs font-mono mb-1">Input: {tc.input}</p>}
                      <p className="text-neutral-400 text-xs font-mono">Output: {tc.expectedOutput}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activePanel === 'participants' && (
          <div className="w-72 bg-neutral-950 border-r border-neutral-800/80 flex flex-col overflow-y-auto px-5 py-4">
            <p className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-3">
              Participants ({users.length})
            </p>
            <div className="space-y-2">
              {users.map((name, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-neutral-300 text-sm truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editor + output */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-neutral-950 border-b border-neutral-800/80">
            <span className="flex items-center gap-2 bg-neutral-900 text-neutral-300 text-xs font-mono px-3 py-1 rounded-t-md border-t border-x border-neutral-800">
              <span className={`w-2 h-2 rounded-full ${language === 'python' ? 'bg-yellow-400' : 'bg-yellow-300'}`} />
              {LANGUAGE_EXT[language]}
            </span>
          </div>

          <div className="flex-1 min-h-0">
            <MonacoEditor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                padding: { top: 16 },
                fontFamily: "'Fira Code', monospace",
                readOnly: sessionStatus === 'completed',
              }}
            />
          </div>

          <div className="h-48 bg-black/60 backdrop-blur-xl border-t border-neutral-800/80 px-5 py-3 overflow-auto">
            {testResults ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-neutral-600 text-xs font-mono uppercase tracking-wider">Test Results</p>
                  <p className={`text-sm font-semibold font-mono ${
                    testResults.passedCount === testResults.totalCount ? "text-green-400" : "text-amber-400"
                  }`}>
                    {testResults.passedCount}/{testResults.totalCount} passed
                  </p>
                </div>
                <div className="space-y-2">
                  {testResults.results.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 border text-xs font-mono ${
                        r.passed ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                      }`}
                    >
                      <span className={r.passed ? "text-green-400" : "text-red-400"}>
                        {r.passed ? "✓ Passed" : "✗ Failed"}
                      </span>
                      {" — "}
                      {r.isHidden ? (
                        <span className="text-neutral-500">Hidden test case</span>
                      ) : (
                        <span className="text-neutral-400">
                          input: {r.input || "(none)"} · expected: {r.expectedOutput} · got: {r.actualOutput}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-neutral-600 text-xs font-mono uppercase tracking-wider mb-2">Output</p>
                <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                  {output || "Run your code to see output here..."}
                </pre>
              </>
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 px-4 py-1 bg-neutral-950 border-t border-neutral-800 text-[11px] font-mono text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Connected
            </span>
            <span>{language === 'python' ? 'Python' : 'JavaScript'}</span>
            <span>{users.length} online</span>
            <span className="ml-auto">Room: {roomId}</span>
          </div>
        </div>

        {activePanel === 'chat' && (
          <div className="w-72 bg-neutral-950 border-l border-neutral-800/80 flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-800">
              <p className="text-neutral-500 text-xs font-mono uppercase tracking-wider">Chat</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-neutral-600 text-sm text-center mt-4 font-mono">No messages yet</p>
              )}
              {messages.map((msg, i) => (
                <div key={i}>
                  <p className="text-blue-400 text-xs font-medium font-mono">{msg.user}</p>
                  <p className="text-neutral-300 text-sm">{msg.message}</p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-neutral-800 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                disabled={sessionStatus === 'completed'}
                className="flex-1 bg-neutral-900 text-white placeholder-neutral-600 text-sm rounded-lg px-3 py-2 outline-none border border-neutral-800 focus:border-blue-500/50 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={sessionStatus === 'completed'}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 disabled:opacity-50 transition-all text-white text-sm rounded-lg px-3"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Editor;