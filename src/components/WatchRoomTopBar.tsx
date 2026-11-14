import { useState } from "react";
import {
  Film,
  UserPlus,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Tv,
  Activity,
  LogOut,
  Copy,
  Check,
  MessageSquare,
  Users,
  Monitor,
  StopCircle,
} from "lucide-react";
import { UserRole } from "../types/signaling";
interface WatchRoomTopBarProps {
  cinemaMode: boolean;
  onToggleCinema: () => void;
  roomId: string;
  roomName: string;
  role: UserRole | "none";
  mediaTitle: string;
  wsConnected: boolean;
  localStreamActive: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isScreenSharing?: boolean;
  isHost?: boolean;
  activeSidebarTab: "chat" | "people";
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSelectSidebarTab: (tab: "chat" | "people") => void;
  onOpenInviteModal: () => void;
  onOpenMediaModal: () => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  onToggleDiagnostics: () => void;
  onEnableMedia: () => void;
  onEnableVoice: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onLeaveRoom: () => void;
}

export function WatchRoomTopBar(p: WatchRoomTopBarProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.roomId);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };
  const panel = (tab: "chat" | "people") => {
    if (p.isSidebarOpen && p.activeSidebarTab === tab) p.onToggleSidebar();
    else p.onSelectSidebarTab(tab);
  };
  return (
    <>
      <header className="night-room-header">
        <div className="night-room-title">
          <div className="night-brand">
            <span>
              <Film size={21} />
            </span>
          </div>
          <div>
            <h1>{p.roomName || "Movie night"}</h1>
            <p role="status">
              {p.wsConnected
                ? "Room connected"
                : "Reconnecting to your room…"}
            </p>
          </div>
        </div>
        <div className="night-room-actions">
          <button
            className={
              "night-control cinema-toggle " + (p.cinemaMode ? "active" : "")
            }
            aria-label={p.cinemaMode ? "Exit cinema mode" : "Cinema mode"}
            aria-pressed={p.cinemaMode}
            onClick={p.onToggleCinema}
          >
            <Film size={16} />
            <span>{p.cinemaMode ? "Exit cinema" : "Cinema mode"}</span>
          </button>
          <button
            className="night-control"
            onClick={copy}
            title={
              copyError
                ? "Copy failed. Select the code to copy it manually."
                : "Copy room code"
            }
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{p.roomId}</span>
          </button>
          <button
            className="night-control active"
            onClick={p.onOpenInviteModal}
          >
            <UserPlus size={16} />
            Invite
          </button>
        </div>
      </header>
      <nav className="night-dock" aria-label="Room controls">
        {!p.localStreamActive ? (
          <>
          <button className="night-control" onClick={p.onEnableMedia}>
            <Video size={19} />
            Enable call
          </button>
          <button className="night-control voice-join" onClick={p.onEnableVoice}><Mic size={17} /> Voice only</button>
          </>
        ) : (
          <>
            <button
              className={"night-control " + (!p.videoEnabled ? "danger" : "")}
              aria-pressed={p.videoEnabled}
              onClick={p.onToggleVideo}
            >
              {p.videoEnabled ? <Video size={19} /> : <VideoOff size={19} />}
              Camera
            </button>
            <button
              className={"night-control " + (!p.audioEnabled ? "danger" : "")}
              aria-pressed={p.audioEnabled}
              onClick={p.onToggleAudio}
            >
              {p.audioEnabled ? <Mic size={19} /> : <MicOff size={19} />}{" "}
              {p.audioEnabled ? "Mic" : "Muted"}
            </button>
          </>
        )}
        <button className="night-control" onClick={p.onOpenMediaModal}>
          <Tv size={19} />
          Media
        </button>
        {p.isScreenSharing ? (
          <button
            className="night-control danger"
            onClick={p.onStopScreenShare}
          >
            <StopCircle size={19} />
            Stop share
          </button>
        ) : p.isHost && p.onStartScreenShare ? (
          <button className="night-control" onClick={p.onStartScreenShare}>
            <Monitor size={19} />
            Share
          </button>
        ) : null}
        <button
          className={
            "night-control " +
            (p.isSidebarOpen && p.activeSidebarTab === "chat" ? "active" : "")
          }
          aria-pressed={p.isSidebarOpen && p.activeSidebarTab === "chat"}
          onClick={() => panel("chat")}
        >
          <MessageSquare size={19} />
          Chat
        </button>
        <button
          className={
            "night-control " +
            (p.isSidebarOpen && p.activeSidebarTab === "people" ? "active" : "")
          }
          aria-pressed={p.isSidebarOpen && p.activeSidebarTab === "people"}
          onClick={() => panel("people")}
        >
          <Users size={19} />
          People
        </button>
        <button
          className="night-control hidden sm:flex"
          onClick={p.onToggleDiagnostics}
        >
          <Activity size={19} />
          Help
        </button>
        <button className="night-control danger" onClick={p.onLeaveRoom}>
          <LogOut size={19} />
          Leave
        </button>
      </nav>
    </>
  );
}
