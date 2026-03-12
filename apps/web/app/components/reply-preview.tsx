import { Message, ReplyPreview } from "../types";
import { FormattedText } from "./formatted-text";

interface ReplyPreviewBarProps {
  replyingTo: Message;
  onCancel: () => void;
}

export function ReplyPreviewBar({ replyingTo, onCancel }: ReplyPreviewBarProps) {
  const snippet =
    replyingTo.text.length > 60
      ? replyingTo.text.slice(0, 60) + "..."
      : replyingTo.text;

  return (
    <div className="flex items-center justify-between border-t border-border bg-sidebar px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-indigo-400">
          Replying to {replyingTo.senderName}
        </p>
        <p className="truncate text-xs text-text-secondary">{snippet}</p>
      </div>
      <button
        onClick={onCancel}
        className="ml-2 flex-shrink-0 rounded p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface ReplyQuoteProps {
  replyTo?: ReplyPreview | null;
}

export function ReplyQuote({ replyTo }: ReplyQuoteProps) {
  if (!replyTo) {
    return (
      <div className="mb-1 border-l-2 border-text-secondary pl-2">
        <p className="text-xs italic text-text-secondary">Original message was deleted</p>
      </div>
    );
  }

  const snippet = !replyTo.text
    ? "This message was deleted"
    : replyTo.text.length > 50
      ? replyTo.text.slice(0, 50) + "..."
      : replyTo.text;

  return (
    <div className="mb-1 border-l-2 border-indigo-400 pl-2">
      <p className="text-[10px] font-medium text-indigo-400">
        {replyTo.senderName}
      </p>
      <FormattedText text={snippet} className="text-xs text-text-secondary" />
    </div>
  );
}
