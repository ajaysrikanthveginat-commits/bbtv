import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  UserPlus,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Crown,
  Sparkles,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isSystem?: boolean;
  isLocal?: boolean;
}

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'participant';
  isLocal: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  isConnected: boolean;
}

interface SidebarProps {
  activeTab: 'chat' | 'people';
  onTabChange: (tab: 'chat' | 'people') => void;
  messages: ChatMessage[];
  participants: Participant[];
  onSendMessage: (text: string) => void;
  onOpenInviteModal: () => void;
  className?: string;
}

export function Sidebar({
  activeTab,
  onTabChange,
  messages,
  participants,
  onSendMessage,
  onOpenInviteModal,
  className = '',
}: SidebarProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <aside
      className={`w-full lg:w-80 xl:w-96 bg-[#0e1017] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl ${className}`}
    >
      {/* Top Tab Bar Header */}
      <div className="bg-[#13151f] p-2 border-b border-white/10 flex items-center justify-between">
        <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 flex-1 mr-2">
          <button
            onClick={() => onTabChange('chat')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
            {messages.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/40">
                {messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('people')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'people'
                ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>People</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/40">
              {participants.filter((p) => p.isConnected).length}
            </span>
          </button>
        </div>

        <button
          onClick={onOpenInviteModal}
          title="Invite Friend"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-[#f4258c]" />
        </button>
      </div>

      {/* TAB CONTENT: CHAT */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0a0b10]">
          {/* Messages Container */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[300px]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-zinc-600 mb-1" />
                <span className="text-xs font-semibold text-zinc-400">Room Chat</span>
                <p className="text-[11px] text-zinc-600">
                  Send a message to your watch party buddy.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="text-center my-2 text-[11px] text-zinc-500 italic bg-white/[0.02] border border-white/5 py-1 px-2.5 rounded-full mx-auto max-w-[90%]"
                    >
                      <span>{msg.text}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.isLocal ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-semibold text-zinc-400">
                        {msg.isLocal ? 'You' : msg.sender}
                      </span>
                      <span className="text-[9px] text-zinc-600">{msg.time}</span>
                    </div>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                        msg.isLocal
                          ? 'bg-[#f4258c] text-white rounded-br-xs'
                          : 'bg-[#181a24] text-zinc-200 border border-white/10 rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-2.5 bg-[#12141d] border-t border-white/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send message to room..."
              className="flex-1 bg-[#090a0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f4258c] focus:border-[#f4258c] transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-xl bg-[#f4258c] hover:bg-[#e01e7e] disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-[#f4258c]/25 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT: PEOPLE */}
      {activeTab === 'people' && (
        <div className="flex-1 flex flex-col p-3 bg-[#0a0b10] space-y-3 overflow-y-auto">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
            Connected Members ({participants.filter((p) => p.isConnected).length}/2)
          </div>

          <div className="space-y-2">
            {participants.map((person) => (
              <div
                key={person.id}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                  person.isConnected
                    ? 'bg-[#141622] border-white/10 shadow-md'
                    : 'bg-[#0e1017]/60 border-white/5 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ${
                      person.isLocal
                        ? 'bg-indigo-600 ring-2 ring-indigo-400/40'
                        : 'bg-[#f4258c] ring-2 ring-[#f4258c]/40'
                    }`}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">
                        {person.name}
                      </span>
                      {person.isLocal && (
                        <span className="text-[9px] text-zinc-400 bg-black/40 px-1 rounded">
                          You
                        </span>
                      )}
                      {person.role === 'host' && (
                        <span className="flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1 py-0.2 rounded font-semibold">
                          <Crown className="w-2.5 h-2.5" /> Host
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono block">
                      ID: {person.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Device Status Icons */}
                <div className="flex items-center gap-1.5">
                  <div
                    title={person.hasVideo ? 'Camera Active' : 'Camera Disabled'}
                    className={`p-1.5 rounded-lg text-xs ${
                      person.hasVideo
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {person.hasVideo ? (
                      <Video className="w-3.5 h-3.5" />
                    ) : (
                      <VideoOff className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div
                    title={person.hasAudio ? 'Microphone Active' : 'Muted'}
                    className={`p-1.5 rounded-lg text-xs ${
                      person.hasAudio
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                        : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                    }`}
                  >
                    {person.hasAudio ? (
                      <Mic className="w-3.5 h-3.5" />
                    ) : (
                      <MicOff className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Invite Friend Promo Card if alone */}
          {participants.filter((p) => p.isConnected).length < 2 && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-[#f4258c]/10 to-transparent border border-[#f4258c]/20 text-center space-y-2">
              <Sparkles className="w-5 h-5 text-[#f4258c] mx-auto" />
              <div className="text-xs font-bold text-white">Movie Night with a Friend</div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Invite a companion to test real-time WebRTC 1:1 camera and mic communication.
              </p>
              <button
                onClick={onOpenInviteModal}
                className="w-full mt-2 py-2 text-xs font-bold text-white bg-[#f4258c] hover:bg-[#e01e7e] rounded-lg transition-all shadow-md shadow-[#f4258c]/25 cursor-pointer"
              >
                Copy Invite Link
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
