import React, { useState } from 'react';
import RepoForm from './components/RepoForm';
import ChatWindow from './components/ChatWindow';
import { Terminal, Database, MessageSquare, Menu, Plus } from 'lucide-react';

function App() {
  const [isRepoIndexed, setIsRepoIndexed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [suggestedPrompt, setSuggestedPrompt] = useState('');

  const suggestions = [
    "Explain project structure",
    "Find authentication logic",
    "Security audit of code",
    "Summarize README.md",
    "Check API endpoints"
  ];

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 rounded-md hover:bg-zinc-800 md:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      <div
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed md:relative z-40 w-[280px] h-full bg-[#000000] border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 font-sans`}
      >
        {/* Sidebar Header */}
        <div className="p-3 mb-2">
          <button
            onClick={() => window.location.reload()}
            className="group flex items-center justify-between px-3 py-2.5 w-full rounded-lg hover:bg-zinc-900 transition-all border border-white/10 hover:border-white/20 text-sm font-medium text-zinc-200 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-white/10 group-hover:bg-white/20 transition-colors">
                <Plus className="h-4 w-4" />
              </div>
              <span>New Chat</span>
            </div>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar">

          {/* Repo Input Section */}
          <div className="space-y-3">
            <h3 className="px-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
              Active Repository
            </h3>
            <RepoForm onRepoIndexed={() => setIsRepoIndexed(true)} />
          </div>

          {/* Suggestions Section */}
          <div className="space-y-2">
            <h3 className="px-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
              Suggestions
            </h3>
            <div className="px-2 space-y-1">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSuggestedPrompt(s);
                    // Briefly reset so it can be re-triggered
                    setTimeout(() => setSuggestedPrompt(''), 100);
                  }}
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
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer group">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center shadow-lg shadow-emerald-900/20 group-hover:shadow-emerald-900/40 transition-all">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">RepoRAG Pro</div>
              <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                Online
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative bg-zinc-900">
        <ChatWindow
          isRepoIndexed={isRepoIndexed}
          suggestedPrompt={suggestedPrompt}
        />
      </main>
    </div>
  );
}

export default App;
