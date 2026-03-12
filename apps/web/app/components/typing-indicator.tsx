interface TypingIndicatorProps {
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : names.length === 3
          ? `${names[0]}, ${names[1]}, and ${names[2]} are typing`
          : `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-text-secondary">{text}</span>
    </div>
  );
}
