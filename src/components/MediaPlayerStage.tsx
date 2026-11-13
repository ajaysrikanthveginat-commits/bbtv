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
}: MediaPlayerStageProps) {
  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
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

      {/* WEBRTC PARTICIPANT VIDEO GRID (Real Phase 1 Video Feeds) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              The best seats in the house
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-[#8b5cf6] border border-[#8b5cf6]/20">
              Just us
            </span>
          </div>

          {!localStream && (
            <button
              onClick={onEnableMedia}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              Enable Camera & Microphone
            </button>
          )}
        </div>

        {/* 2-Column Participant Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </div>
  );
}
