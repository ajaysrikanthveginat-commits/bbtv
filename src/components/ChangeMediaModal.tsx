import { useState } from 'react';
import {
  X,
  Film,
  Monitor,
  Upload,
  Link,
  Play,
  Clock,
  Sparkles,
  Lock,
  Check,
} from 'lucide-react';

interface MovieItem {
  id: string;
  title: string;
  duration: string;
  genre: string;
  description: string;
  poster: string;
  year: string;
}

const SAMPLE_MOVIES: MovieItem[] = [
  {
    id: 'cosmos-laundromat',
    title: 'Cosmos Laundromat',
    duration: '12m 45s',
    genre: 'Sci-Fi / Animation',
    description: 'On a desolate island, a suicidal sheep meets a quirky salesman offering him the gift of a lifetime.',
    poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
    year: '2024 Remaster',
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny (4K)',
    duration: '9m 56s',
    genre: 'Comedy / Family',
    description: 'A large and lovable rabbit deals with bullying forest creatures in the iconic open-source masterpiece.',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    year: '4K Ultra HD',
  },
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel',
    duration: '12m 14s',
    genre: 'Action / Sci-Fi',
    description: 'In dystopian Amsterdam, a group of scientists attempts to stage a crucial event from the past to save humanity.',
    poster: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80',
    year: 'Sci-Fi Classic',
  },
  {
    id: 'sintel',
    title: 'Sintel: The Dragon Search',
    duration: '14m 48s',
    genre: 'Fantasy / Adventure',
    description: 'A lonely young woman searches the dangerous wilderness for her stolen dragon companion.',
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    year: 'Fantasy Epic',
  },
];

interface ChangeMediaModalProps {
  isOpen: boolean;
  currentMediaTitle: string;
  isHost?: boolean;
  isScreenSharing?: boolean;
  onClose: () => void;
  onSelectMovieTitle: (title: string) => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
}

export function ChangeMediaModal({
  isOpen,
  currentMediaTitle,
  isHost = true,
  isScreenSharing = false,
  onClose,
  onSelectMovieTitle,
  onStartScreenShare,
  onStopScreenShare,
}: ChangeMediaModalProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'screen' | 'local' | 'url'>('library');
  const [selectedMovieId, setSelectedMovieId] = useState<string>('cosmos-laundromat');

  if (!isOpen) return null;

  const handleSelect = (movie: MovieItem) => {
    setSelectedMovieId(movie.id);
    onSelectMovieTitle(movie.title);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-2xl bg-[#11131c] border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black text-zinc-100 flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <h3 className="text-lg font-bold text-white tracking-wide">
            Select Media to Watch
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Choose a movie, share your screen, or upload a video
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 mb-5 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'library'
                ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Movie Library</span>
          </button>

          <button
            onClick={() => setActiveTab('screen')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'screen'
                ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Screen Share</span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-zinc-400">
              Phase 2
            </span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'local'
                ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Local Video</span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-zinc-400">
              Phase 3
            </span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'url'
                ? 'bg-[#f4258c] text-white shadow-md shadow-[#f4258c]/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Direct URL</span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-zinc-400">
              Phase 4
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: MOVIE LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400 flex items-center justify-between">
                <span>Featured Open Movies & Trailers:</span>
                <span className="text-[#f4258c] font-semibold text-[11px]">
                  Click to select title for stage
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SAMPLE_MOVIES.map((movie) => {
                  const isCurrent = currentMediaTitle.includes(movie.title);
                  return (
                    <div
                      key={movie.id}
                      onClick={() => handleSelect(movie)}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-[#181a26] border-[#f4258c] shadow-lg shadow-[#f4258c]/15 ring-1 ring-[#f4258c]/40'
                          : 'bg-[#0f1118] border-white/10 hover:border-white/20 hover:bg-[#141622]'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0 relative">
                          <img
                            src={movie.poster}
                            alt={movie.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-[#f4258c]">
                              {movie.year}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                                <Check className="w-3 h-3" /> Selected
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-white truncate mt-0.5">
                            {movie.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{movie.duration}</span>
                            <span>•</span>
                            <span className="truncate">{movie.genre}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1">
                            {movie.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SCREEN SHARE */}
          {activeTab === 'screen' && (
            <div className="py-8 px-4 text-center space-y-4 bg-[#0a0b10] rounded-xl border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f4258c] to-[#a81c60] flex items-center justify-center text-white mx-auto shadow-lg shadow-[#f4258c]/25">
                <Monitor className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-bold text-white">
                  {isScreenSharing ? 'Screen Sharing Active' : 'Live Screen Sharing'}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {isScreenSharing
                    ? 'Your screen is currently broadcasting in real time to the watch party stage via WebRTC.'
                    : 'Stream your entire screen, an application window, or a browser tab directly into the watch room with ultra-low latency peer-to-peer WebRTC.'}
                </p>
              </div>

              {isScreenSharing ? (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (onStopScreenShare) onStopScreenShare();
                      onClose();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
                  >
                    Stop Screen Sharing
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs transition-colors cursor-pointer"
                  >
                    Keep Sharing & Return
                  </button>
                </div>
              ) : (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {isHost ? (
                    <button
                      onClick={() => {
                        if (onStartScreenShare) onStartScreenShare();
                        onClose();
                      }}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f4258c] to-[#e01e7e] hover:brightness-110 text-white font-bold text-xs transition-all shadow-lg shadow-[#f4258c]/30 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Monitor className="w-4 h-4" />
                      <span>Start Screen Share</span>
                    </button>
                  ) : (
                    <div className="text-xs text-zinc-400 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                      Host screen sharing can be initiated by the room host.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOCAL VIDEO (Coming in Phase 3) */}
          {activeTab === 'local' && (
            <div className="py-12 px-4 text-center space-y-3 bg-[#0a0b10] rounded-xl border border-white/5">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 mx-auto">
                <Lock className="w-6 h-6 text-zinc-400" />
              </div>
              <h4 className="text-sm font-bold text-white">Local Video Upload (Phase 3)</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Select your own MP4, MKV, or WebM files from your disk to play synchronized across your watch party.
              </p>
              <div className="inline-block px-3 py-1 rounded-full bg-[#f4258c]/15 text-[#f4258c] text-[11px] font-semibold border border-[#f4258c]/30">
                Disabled in Phase 1 Baseline
              </div>
            </div>
          )}

          {/* TAB 4: DIRECT URL (Coming in Phase 4) */}
          {activeTab === 'url' && (
            <div className="py-12 px-4 text-center space-y-3 bg-[#0a0b10] rounded-xl border border-white/5">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 mx-auto">
                <Lock className="w-6 h-6 text-zinc-400" />
              </div>
              <h4 className="text-sm font-bold text-white">Direct Stream URL (Phase 4)</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Stream public HLS, DASH, or MP4 video URLs directly into the synchronized video player.
              </p>
              <div className="inline-block px-3 py-1 rounded-full bg-[#f4258c]/15 text-[#f4258c] text-[11px] font-semibold border border-[#f4258c]/30">
                Disabled in Phase 1 Baseline
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
