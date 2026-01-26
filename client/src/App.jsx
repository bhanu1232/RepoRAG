import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import RepoForm from './components/RepoForm';
import ChatWindow from './components/ChatWindow';
import { Terminal, Menu, Plus, X } from 'lucide-react';
import logo from './assets/logo.png';

// Protected Route Component
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
};

function Dashboard() {
  const [isRepoIndexed, setIsRepoIndexed] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  // Initialize based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [suggestedPrompt, setSuggestedPrompt] = useState('');
  const { logout, currentUser } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const suggestions = [
    "Give me architecture flowchart",
    "Give me the Route flowchart",
    "Explain project structure",
    "Check API endpoints",
    "Find authentication logic",
    "Security audit of code",
    "Summarize README.md",
  ];

  const handleSuggestionClick = (s) => {
    setSuggestedPrompt(s);
    setTimeout(() => setSuggestedPrompt(''), 100);
    // Close sidebar on mobile when selection is made
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-black text-gray-100 font-sans overflow-hidden relative">
      {/* Mobile Sidebar Backrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Menu Button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-20 p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white md:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed md:relative z-40 w-[280px] h-full bg-[#000000] border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 font-sans`}
      >
        {/* Sidebar Header */}
        <div className="p-3 mb-2 flex items-center justify-between gap-2">
          <button
            onClick={() => window.location.reload()}
            className="group flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-900 transition-all border border-white/10 hover:border-white/20 text-sm font-medium text-zinc-200 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-white/10 group-hover:bg-white/20 transition-colors">
                <Plus className="h-4 w-4" />
              </div>
              <span>New Chat</span>
            </div>
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar">

          {/* Repo Input Section - Only show when a repo is active (to allow switching) */}
          {isRepoIndexed && (
            <div className="space-y-3">
              <h3 className="px-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                Active Repository
              </h3>
              <RepoForm
                onRepoIndexed={(url) => {
                  setIsRepoIndexed(true);
                  setRepoUrl(url);
                }}
                isIndexed={isRepoIndexed}
              />
            </div>
          )}

          {/* Suggestions Section */}
          <div className="space-y-2">
            <h3 className="px-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
              Suggestions
            </h3>
            <div className="px-2 space-y-1">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900 cursor-pointer transition-colors text-sm text-zinc-400 hover:text-zinc-200"
                >
                  <Terminal className="h-4 w-4 opacity-50" />
                  <span className="truncate">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 bg-[#000000]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-2 hover:bg-zinc-900 transition-colors group">
            <div className="h-8 w-8 rounded-full bg-emerald-900/50 flex items-center justify-center text-xs font-bold text-emerald-400 border border-emerald-900">
              {currentUser?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{currentUser?.email}</div>
              <button onClick={logout} className="text-[10px] text-zinc-500 hover:text-white transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative bg-zinc-900">
        <ChatWindow
          isRepoIndexed={isRepoIndexed}
          suggestedPrompt={suggestedPrompt}
          repoUrl={repoUrl}
          onRepoIndexed={(url) => {
            setIsRepoIndexed(true);
            setRepoUrl(url);
          }}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
