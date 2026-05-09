// Discord-style unread marker. Rendered between two consecutive MessageBubbles
// to indicate the boundary between read and unread messages. Anchored to a
// client-side snapshot of `lastReadAt` taken on page mount, so the marker
// stays put even after the server-side mark-read fires later.
export function UnreadSeparator() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-red-500/70" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
        New
      </span>
      <div className="h-px flex-1 bg-red-500/70" />
    </div>
  );
}
