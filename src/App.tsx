/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Shield, Search, Activity, FileText, Send, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type LogEntry = {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system' | 'ai';
  message: string;
  timestamp: Date;
};

type AgentState = 'idle' | 'thinking' | 'awaiting_approval' | 'executing';

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [target, setTarget] = useState('');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [pendingAction, setPendingAction] = useState<{ command: string; reasoning: string } | null>(null);
  const [filter, setFilter] = useState<LogEntry['type'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setShowScrollBottom(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.type === filter;
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      type,
      message,
      timestamp: new Date()
    }]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  useEffect(() => {
    addLog('HackBot v2.0 initialized. System ready.', 'system');
    addLog('Awaiting target assignment...', 'info');
  }, []);

  const handleStartRecon = async () => {
    if (!target) {
      addLog('Error: No target specified.', 'error');
      return;
    }

    setAgentState('thinking');
    addLog(`Initiating ReconAgent for target: ${target}`, 'ai');
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not found in environment");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `You are the ReconAgent of HackBot v2.0. 
        The user wants to perform reconnaissance on: ${target}.
        User context: ${input || "Standard reconnaissance scan requested."}
        
        Analyze the target and suggest the best nmap command to run. 
        Format your response as JSON with "reasoning" and "command" fields.`,
        config: {
            responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || "{}");
      
      if (data.error) throw new Error(data.error);
      
      setPendingAction(data);
      setAgentState('awaiting_approval');
      addLog('ReconAgent has proposed an action. Awaiting human approval.', 'warning');
    } catch (error) {
      addLog(`Agent Error: ${(error as Error).message}`, 'error');
      setAgentState('idle');
    }
  };

  const executeAction = async () => {
    if (!pendingAction) return;

    setAgentState('executing');
    addLog(`Executing: ${pendingAction.command}`, 'system');

    try {
      const response = await fetch('/api/tools/nmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, args: pendingAction.command.replace('nmap ', '') })
      });
      
      const data = await response.json();
      addLog('Tool execution complete. Analyzing results...', 'success');
      
      // In a full implementation, we'd send these results back to the LLM for interpretation
      addLog(`Scan Results:\n${data.output}`, 'info');
      
      setPendingAction(null);
      setAgentState('idle');
      setInput('');
    } catch (error) {
      addLog(`Execution Error: ${(error as Error).message}`, 'error');
      setAgentState('idle');
    }
  };

  const cancelAction = () => {
    addLog('Action cancelled by user.', 'warning');
    setPendingAction(null);
    setAgentState('idle');
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#00ff41] font-mono selection:bg-[#00ff41] selection:text-black p-4 md:p-8 flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#00ff41]/20 pb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#00ff41] animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase italic">HackBot v2.0</h1>
            <p className="text-[10px] opacity-50 uppercase tracking-widest">Advanced Agentic Security Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", agentState === 'idle' ? "bg-[#00ff41]" : "bg-yellow-500 animate-ping")} />
            <span className="uppercase">{agentState}</span>
          </div>
          <div className="px-3 py-1 border border-[#00ff41]/30 rounded text-[10px]">
            SEC_LEVEL: ALPHA
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
          <div className="bg-black/40 border border-[#00ff41]/20 rounded-lg p-4 flex flex-col gap-4">
            <h2 className="text-xs uppercase font-bold opacity-70 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Target Configuration
            </h2>
            <div className="space-y-2">
              <label className="text-[10px] uppercase opacity-50">Target IP/Domain</label>
              <input 
                type="text" 
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 192.168.1.1"
                className="w-full bg-black border border-[#00ff41]/30 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#00ff41] transition-colors"
                disabled={agentState !== 'idle'}
              />
            </div>
            <button 
              onClick={handleStartRecon}
              disabled={agentState !== 'idle' || !target}
              className="w-full bg-[#00ff41] text-black font-bold py-2 rounded flex items-center justify-center gap-2 hover:bg-[#00cc33] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {agentState === 'thinking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              INITIALIZE RECON
            </button>
          </div>

          <div className="bg-black/40 border border-[#00ff41]/20 rounded-lg p-4 flex-1 overflow-y-auto">
            <h2 className="text-xs uppercase font-bold opacity-70 mb-4 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Agent Modules
            </h2>
            <div className="space-y-3">
              {[
                { name: 'ReconAgent', status: 'ACTIVE', icon: Search },
                { name: 'AnalystAgent', status: 'STANDBY', icon: Shield },
                { name: 'ReporterAgent', status: 'STANDBY', icon: FileText },
              ].map((agent) => (
                <div key={agent.name} className="flex items-center justify-between p-2 border border-[#00ff41]/10 rounded bg-black/20">
                  <div className="flex items-center gap-2">
                    <agent.icon className="w-3 h-3" />
                    <span className="text-xs">{agent.name}</span>
                  </div>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded", agent.status === 'ACTIVE' ? "bg-[#00ff41]/20 text-[#00ff41]" : "bg-white/5 text-white/30")}>
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Terminal Area */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex-1 bg-black/60 border border-[#00ff41]/20 rounded-lg flex flex-col overflow-hidden relative">
            {/* Terminal Header */}
            <div className="bg-[#00ff41]/10 px-4 py-2 flex flex-col md:flex-row md:items-center justify-between border-b border-[#00ff41]/20 gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-tighter">System Console</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 opacity-40" />
                  <input 
                    type="text"
                    placeholder="SEARCH LOGS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-black/40 border border-[#00ff41]/20 rounded px-7 py-1 text-[10px] focus:outline-none focus:border-[#00ff41]/50 w-32 md:w-48"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded border border-[#00ff41]/10">
                  {(['all', 'info', 'success', 'warning', 'error', 'system', 'ai'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={cn(
                        "text-[9px] px-2 py-0.5 rounded uppercase transition-all",
                        filter === type 
                          ? "bg-[#00ff41] text-black font-bold" 
                          : "text-[#00ff41]/40 hover:text-[#00ff41]/70"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => setLogs([])}
                  className="text-[9px] px-2 py-1 border border-red-500/30 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 rounded uppercase transition-all"
                >
                  CLEAR
                </button>

                <div className="text-[9px] opacity-30 uppercase ml-2">
                  {filteredLogs.length} / {logs.length} ENTRIES
                </div>
              </div>
            </div>

            {/* Terminal Logs */}
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 p-4 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-[#00ff41]/20"
            >
              <AnimatePresence initial={false}>
                {filteredLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-3 text-sm group"
                  >
                    <span className="opacity-30 text-[10px] pt-1 shrink-0">
                      {log.timestamp.toLocaleTimeString([], { hour12: false })}
                    </span>
                    <span className={cn(
                      "shrink-0 font-bold",
                      log.type === 'system' && "text-blue-400",
                      log.type === 'ai' && "text-purple-400",
                      log.type === 'success' && "text-[#00ff41]",
                      log.type === 'warning' && "text-yellow-400",
                      log.type === 'error' && "text-red-400",
                      log.type === 'info' && "text-white/70"
                    )}>
                      {log.type.toUpperCase()}:
                    </span>
                    <div className="whitespace-pre-wrap break-all opacity-90">
                      {log.message}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Scroll to Bottom Button */}
            <AnimatePresence>
              {showScrollBottom && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-20 right-8 bg-[#00ff41] text-black p-2 rounded-full shadow-lg hover:bg-[#00cc33] transition-all z-20"
                >
                  <Send className="w-4 h-4 rotate-90" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Human-in-the-Loop Overlay */}
            <AnimatePresence>
              {pendingAction && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-4 left-4 right-4 bg-black border-2 border-yellow-500 rounded-lg p-4 shadow-[0_0_30px_rgba(234,179,8,0.2)] z-10"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-yellow-500 text-black p-2 rounded">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-yellow-500 font-bold uppercase text-sm mb-1">Human-in-the-Loop Confirmation Required</h3>
                      <div className="bg-white/5 p-3 rounded mb-4">
                        <p className="text-xs text-white/70 mb-2 italic">"{pendingAction.reasoning}"</p>
                        <code className="text-sm text-[#00ff41] block bg-black p-2 rounded border border-[#00ff41]/20">
                          {pendingAction.command}
                        </code>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={executeAction}
                          className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors"
                        >
                          <Check className="w-4 h-4" /> AUTHORIZE EXECUTION
                        </button>
                        <button 
                          onClick={cancelAction}
                          className="px-6 border border-white/20 text-white/50 font-bold py-2 rounded flex items-center justify-center gap-2 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" /> ABORT
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-4 border-t border-[#00ff41]/20 bg-black/40">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) handleStartRecon();
                }}
                className="flex items-center gap-3"
              >
                <span className="text-[#00ff41] font-bold shrink-0">root@hackbot:~#</span>
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter mission parameters or custom instructions..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-[#00ff41]/20"
                  disabled={agentState !== 'idle'}
                />
                <button 
                  type="submit"
                  disabled={agentState !== 'idle' || !input.trim()}
                  className="p-2 text-[#00ff41] hover:bg-[#00ff41]/10 rounded-full transition-colors disabled:opacity-20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Stats */}
      <footer className="flex items-center justify-between text-[10px] uppercase opacity-40 border-t border-[#00ff41]/10 pt-4">
        <div className="flex gap-6">
          <span>UPTIME: 00:04:12</span>
          <span>CPU_LOAD: 12%</span>
          <span>MEM_USAGE: 256MB</span>
        </div>
        <div className="flex gap-6">
          <span>ENCRYPTION: AES-256-GCM</span>
          <span>CONNECTION: SECURE_TUNNEL</span>
        </div>
        <div className="flex items-center gap-1">
          <span>MADE BY</span>
          <a 
            href="https://www.instagram.com/sumit.shingne_?igsh=MTN3eTNsNDJ3YXhvYw==" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-[#00ff41] transition-colors font-bold"
          >
            SUMIT SHINGNE
          </a>
        </div>
      </footer>
    </div>
  );
}
