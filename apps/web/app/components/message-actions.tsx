interface MessageActionsProps {
  isOwn: boolean;
  isPinned: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  onPin: () => void;
  onForward?: () => void;
  onStar?: () => void;
  isStarred?: boolean;
}

export function MessageActions({
  isOwn,
  isPinned,
  onEdit,
  onDelete,
  onReply,
  onPin,
  onForward,
  onStar,
  isStarred,
}: MessageActionsProps) {
  return (
    <div className={`absolute -top-3 z-10 flex items-center gap-0.5 rounded-md border border-border bg-sidebar p-0.5 opacity-0 shadow-md transition-opacity group-hover:opacity-100 ${isOwn ? "right-0" : "left-0"}`}>
      <ActionButton title="Reply" onClick={onReply}>
        <path d="M9 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l-5 5v-5z" />
      </ActionButton>
      {onForward && (
        <ActionButton title="Forward" onClick={onForward}>
          <path d="m15 17 5-5-5-5" />
          <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
        </ActionButton>
      )}
      {onStar && (
        <ActionButton title={isStarred ? "Unstar" : "Star"} onClick={onStar}>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={isStarred ? "currentColor" : "none"}
          />
        </ActionButton>
      )}
      {isOwn && (
        <ActionButton title="Edit" onClick={onEdit}>
          <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </ActionButton>
      )}
      {isOwn && (
        <ActionButton title="Delete" onClick={onDelete}>
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </ActionButton>
      )}
      <ActionButton title={isPinned ? "Unpin" : "Pin"} onClick={onPin}>
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.76z" />
      </ActionButton>
    </div>
  );
}

function ActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-hover hover:text-text-primary"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}
