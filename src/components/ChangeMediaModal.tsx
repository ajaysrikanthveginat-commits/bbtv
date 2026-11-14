import { useEffect, useRef } from "react";
import { X, Link, Monitor } from "lucide-react";
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
  isHost = true,
  isScreenSharing = false,
  onClose,
  onStartScreenShare,
  onStopScreenShare,
}: ChangeMediaModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [isOpen]);
  return (
    <dialog
      ref={dialog}
      className="media-dialog"
      aria-labelledby="media-heading"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="media-dialog-body">
        <button
          className="night-control media-close"
          onClick={onClose}
          aria-label="Close media options"
        >
          <X size={18} />
        </button>
        <span className="night-eyebrow">PICK YOUR MOVIE-NIGHT MODE</span>
        <h2 id="media-heading">What are we watching?</h2>
        <p>Two ways to bring something to your shared screen.</p>
        <button
          className="media-option"
          disabled={!isHost || isScreenSharing}
          onClick={() => {
            onClose();
            window.setTimeout(
              () => document.getElementById("video-source")?.focus(),
              0,
            );
          }}
        >
          <Link size={24} />
          <div>
            <h3>Watch a video link</h3>
            <p>
              {isScreenSharing
                ? "Stop screen sharing to return to the synchronized player."
                : isHost
                  ? "Paste a direct HTTPS video link into the player. Play, pause, and seek together."
                  : "Your host can load a video link. Both of you can get ready in the player."}
            </p>
          </div>
        </button>
        <button
          className="media-option"
          disabled={!isHost && !isScreenSharing}
          onClick={() => {
            if (isScreenSharing) onStopScreenShare?.();
            else onStartScreenShare?.();
            onClose();
          }}
        >
          <Monitor size={24} />
          <div>
            <h3>
              {isScreenSharing ? "Stop screen sharing" : "Share your screen"}
            </h3>
            <p>
              {isHost
                ? "Choose a browser tab, window, or display. Include tab audio when your browser offers it."
                : "Your host can start a screen share from their device."}
            </p>
          </div>
        </button>
      </div>
    </dialog>
  );
}
