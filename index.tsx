import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Shield, AlertTriangle, Terminal, Send, Lock, Eye, Database, Activity, RefreshCw } from 'lucide-react';

// Types
interface Message {
  sender: 'scammer' | 'agent';
  text: string;
  timestamp: string;
}

interface Intelligence {
  bankAccounts: string[];
  upiIds: string[];
  phishingLinks: string[];
  phoneNumbers: string[];
  suspiciousKeywords: string[];
}

const App = () => {
  // State
  const [sessionId, setSessionId] = useState(`sess-${Math.random().toString(36).substring(7)}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scamDetected, setScamDetected] = useState(false);
  const [intelligence, setIntelligence] = useState<Intelligence>({
    bankAccounts: [],
    upiIds: [],
    phishingLinks: [],
    phoneNumbers: [],
    suspiciousKeywords: []
  });
  const [apiKey, setApiKey] = useState('YOUR_SECRET_API_KEY');
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      sender: 'scammer',
      text: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/honeypot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          sessionId: sessionId,
          message: userMsg
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        const agentMsg: Message = {
          sender: 'agent',
          text: data.reply,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, agentMsg]);
        setScamDetected(data.scam_detected);
        setIntelligence(data.intelligence);
      } else {
        console.error("Backend Error", data);
      }
    } catch (error) {
      console.error("Network Error", error);
      const errorMsg: Message = {
        sender: 'agent',
        text: "⚠️ Network Error: Ensure Backend is running at " + backendUrl,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setSessionId(`sess-${Math.random().toString(36).substring(7)}`);
    setMessages([]);
    setScamDetected(false);
    setIntelligence({
      bankAccounts: [], upiIds: [], phishingLinks: [], phoneNumbers: [], suspiciousKeywords: []
    });
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      
      {/* Sidebar: Config & Status */}
      <div className="w-80 border-r border-gray-800 flex flex-col bg-gray-900">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-blue-500" />
            <h1 className="font-bold text-lg">Agentic HoneyPot</h1>
          </div>
          <p className="text-xs text-gray-400">Analyst Dashboard v1.0</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Status Card */}
          <div className={`p-4 rounded-lg border ${scamDetected ? 'bg-red-900/20 border-red-500/50' : 'bg-green-900/20 border-green-500/50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-300">Threat Status</span>
              {scamDetected ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <Shield className="w-5 h-5 text-green-500" />}
            </div>
            <div className={`text-xl font-bold ${scamDetected ? 'text-red-400' : 'text-green-400'}`}>
              {scamDetected ? 'SCAM DETECTED' : 'SAFE'}
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Session ID</label>
              <div className="flex gap-2 mt-1">
                <input 
                  value={sessionId} 
                  readOnly 
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-xs font-mono text-gray-300" 
                />
                <button onClick={resetSession} className="p-2 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition">
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Backend URL</label>
              <input 
                value={backendUrl} 
                onChange={(e) => setBackendUrl(e.target.value)}
                className="mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-xs text-gray-300 focus:border-blue-500 focus:outline-none" 
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">API Key</label>
              <div className="relative mt-1">
                <input 
                  type="password"
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-xs text-gray-300 focus:border-blue-500 focus:outline-none" 
                />
                <Lock className="w-3 h-3 text-gray-500 absolute right-3 top-2.5" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <Activity className="w-3 h-3" />
            <span>System Operational</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-950 relative">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur">
          <h2 className="font-semibold text-gray-200">Live Interception</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-800/50">Agent: Amit (Elderly Persona)</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4 opacity-50">
              <Terminal className="w-16 h-16" />
              <p>Waiting for incoming connection...</p>
              <p className="text-sm">Type below to simulate a scammer message.</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'scammer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-xl p-4 ${
                msg.sender === 'scammer' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
              }`}>
                <div className="text-xs opacity-70 mb-1 flex justify-between gap-4">
                  <span className="uppercase font-bold tracking-wider">{msg.sender}</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          
          {loading && (
             <div className="flex justify-start">
               <div className="bg-gray-800 rounded-xl rounded-bl-none p-4 border border-gray-700 flex gap-2 items-center">
                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-gray-900 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Simulate Scammer Message..."
              className="flex-1 bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button 
              onClick={handleSendMessage}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Intelligence */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-500" />
            <h2 className="font-bold text-gray-200">Intelligence Log</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section: Phishing Links */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Phishing Links</h3>
            {intelligence.phishingLinks.length > 0 ? (
              <div className="space-y-2">
                {intelligence.phishingLinks.map((link, i) => (
                  <div key={i} className="bg-red-900/20 border border-red-900/50 p-2 rounded text-red-300 text-xs break-all">
                    {link}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-600 italic">No links detected yet</div>
            )}
          </div>

          {/* Section: UPI IDs */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">UPI IDs</h3>
             {intelligence.upiIds.length > 0 ? (
              <div className="space-y-2">
                {intelligence.upiIds.map((upi, i) => (
                  <div key={i} className="bg-yellow-900/20 border border-yellow-900/50 p-2 rounded text-yellow-300 text-xs font-mono">
                    {upi}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-600 italic">No UPI IDs detected yet</div>
            )}
          </div>

          {/* Section: Keywords */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Suspicious Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {intelligence.suspiciousKeywords.map((kw, i) => (
                <span key={i} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
                  {kw}
                </span>
              ))}
               {intelligence.suspiciousKeywords.length === 0 && (
                 <span className="text-xs text-gray-600 italic">None</span>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
