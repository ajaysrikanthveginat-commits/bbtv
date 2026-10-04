import { useState } from 'react';
import { X, Copy, Check, Link2, Key, Users, QrCode } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  roomId: string;
  onClose: () => void;
}

export function InviteModal({ isOpen, roomId, onClose }: InviteModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const shareableUrl = `${window.location.origin}/?room=${roomId}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-[#11131c] border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black text-zinc-100 space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f4258c]/15 border border-[#f4258c]/30 flex items-center justify-center text-[#f4258c] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Invite Friends to Watch
            </h3>
            <p className="text-xs text-zinc-400">
              Share the room code or link to begin synchronized media and video calls.
            </p>
          </div>
        </div>

        {/* Room Code Section */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Key className="w-3.5 h-3.5 text-[#f4258c]" />
            <span>Room Code</span>
          </label>
          <div className="flex items-center gap-2 bg-[#090a0f] border border-white/10 rounded-xl p-2 pl-3">
            <span className="flex-1 font-mono text-base font-bold text-white tracking-widest uppercase">
              {roomId}
            </span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f4258c] hover:bg-[#e01e7e] text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-[#f4258c]/20 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Shareable Link Section */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Link2 className="w-3.5 h-3.5 text-[#f4258c]" />
            <span>Shareable Link</span>
          </label>
          <div className="flex items-center gap-2 bg-[#090a0f] border border-white/10 rounded-xl p-2 pl-3">
            <span className="flex-1 font-mono text-xs text-zinc-300 truncate">
              {shareableUrl}
            </span>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-all border border-white/10 cursor-pointer whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Hint */}
        <div className="bg-black/30 border border-white/5 p-3 rounded-xl text-[11px] text-zinc-400 flex items-start gap-2">
          <QrCode className="w-4 h-4 text-[#f4258c] shrink-0 mt-0.5" />
          <span>
            The other participant can paste this code or link in any modern browser to immediately join your Phase 1 WebRTC room.
          </span>
        </div>
      </div>
    </div>
  );
}
