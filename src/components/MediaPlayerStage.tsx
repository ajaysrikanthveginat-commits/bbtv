import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ChatMessage } from "./Sidebar";
import { WatchTogetherPlayer } from "./WatchTogetherPlayer";
import { SignalingService } from "../services/SignalingService";
import { LocalVideo } from "./LocalVideo";
import { RemoteVideo } from "./RemoteVideo";
import { RemoteScreenShare } from "./RemoteScreenShare";

interface MediaPlayerStageProps {
  signaling: SignalingService | null;
  roomId: string;
  mediaTitle: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteScreenStream?: MediaStream | null;
  localUserId: string;
  localUserName: string;
  remoteUserId: string | null;
  remoteUserName: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isHost?: boolean;
  isScreenSharing?: boolean;
  screenShareOwner?: "local" | "remote" | null;
  screenStream?: MediaStream | null;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  onOpenMediaModal: () => void;
  onOpenInviteModal: () => void;
  onEnableMedia: () => void;
  messages: ChatMessage[];
  companion: ReactNode;
}

export function MediaPlayerStage({
  signaling,
  roomId,
  mediaTitle,
  localStream,
  remoteStream,
  remoteScreenStream = null,
  localUserId,
  localUserName,
  remoteUserId,
  remoteUserName,
  videoEnabled,
  audioEnabled,
  isHost = true,
  isScreenSharing = false,
  screenShareOwner = null,
  screenStream = null,
  onStartScreenShare,
  onStopScreenShare,
  onOpenMediaModal,
  onOpenInviteModal,
  onEnableMedia,
  messages,
  companion,
}: MediaPlayerStageProps) {
  const [reaction, setReaction] = useState<ChatMessage | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const lastMessage = messages.at(-1);
  useEffect(() => {
    if (!lastMessage || !["❤️", "😂", "👏", "🍿"].includes(lastMessage.text)) return;
    setReaction(lastMessage);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setReaction(null), 2400);
  }, [lastMessage]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="cinema-layout">
      <div className="shared-stage">
      {reaction && <div key={reaction.id} className="stage-reaction" aria-hidden="true">{reaction.text}</div>}
      {/* If Screen Sharing is active, render the dedicated live screen share stage */}
      {isScreenSharing ? (
        <RemoteScreenShare
          stream={
            screenShareOwner === "local"
              ? screenStream
              : remoteScreenStream || remoteStream
          }
          ownerName={screenShareOwner === "local" ? "You" : remoteUserName}
          isLocal={screenShareOwner === "local"}
          onStopSharing={onStopScreenShare}
        />
      ) : (
        <WatchTogetherPlayer
          signaling={signaling}
          roomId={roomId}
          userId={localUserId}
        />
      )}

      </div>

      <div className="cinema-companion">
      <div className="participant-section space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              In the room
            </span>
          </div>

          {!localStream && (
            <button
              onClick={onEnableMedia}
              className="cinema-call-link text-xs font-semibold cursor-pointer"
            >
              Turn on your call
            </button>
          )}
        </div>

        {/* 2-Column Participant Row */}
        <div className="call-grid">
          {/* REMOTE PARTICIPANT TILE */}
          <RemoteVideo
            stream={remoteStream}
            remoteUserId={remoteUserId}
            localStreamId={localStream ? localStream.id : null}
            userName={remoteUserName}
            onInviteClick={onOpenInviteModal}
          />

          {/* LOCAL CAMERA TILE */}
          <LocalVideo
            stream={localStream}
            videoEnabled={videoEnabled}
            audioEnabled={audioEnabled}
            userId={localUserId}
            userName={localUserName}
          />
        </div>
      </div>
        {companion}
      </div>
    </div>
  );
}
