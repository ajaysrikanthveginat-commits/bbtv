import { useEffect, useRef, useState } from "react";
import { X, Copy, Check, ArrowUpRight, Ticket } from "lucide-react";
interface InviteModalProps {
  isOpen: boolean;
  roomId: string;
  onClose: () => void;
}
export function InviteModal({ isOpen, roomId, onClose }: InviteModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const shareableUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setError("");
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [isOpen]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setError("");
    } catch {
      setError(
        "Copy is unavailable here. Select the link below and copy it manually.",
      );
    }
  };
  const share = async () => {
    try {
      await navigator.share({
        title: "Join me on BBTV",
        text: "Your seat is waiting. Let’s watch something together.",
        url: shareableUrl,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError("Sharing is unavailable. Copy the invite link instead.");
    }
  };
  return (
    <dialog
      ref={dialog}
      className="media-dialog invite-dialog"
      aria-labelledby="invite-heading"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="media-dialog-body">
        <button
          className="night-control media-close"
          aria-label="Close invitation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <span className="night-eyebrow">ONE LINK. GOOD COMPANY.</span>
        <h2 id="invite-heading">Save them a seat.</h2>
        <p>Send this invitation to your movie-night companion.</p>
        <div className="invite-ticket">
          <Ticket size={25} />
          <div>
            <span>YOUR PRIVATE MOVIE NIGHT</span>
            <strong>{roomId}</strong>
            <p>Admit one friend · Bring the popcorn</p>
          </div>
        </div>
        <label className="invite-label" htmlFor="invite-link">
          Invitation link
        </label>
        <input
          id="invite-link"
          className="invite-link"
          value={shareableUrl}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="invite-actions">
          <button className="night-primary" onClick={copy}>
            {copied ? <Check size={18} /> : <Copy size={18} />}{" "}
            {copied ? "Link copied" : "Copy invitation"}
          </button>
          {typeof navigator.share === "function" && (
            <button className="night-control" onClick={share}>
              <ArrowUpRight size={18} />
              Share
            </button>
          )}
        </div>
        <p className="watch-hint" role="status">
          {error ||
            (copied
              ? "Ready to paste into your conversation."
              : "Anyone with this link can join while the guest seat is available.")}
        </p>
      </div>
    </dialog>
  );
}
