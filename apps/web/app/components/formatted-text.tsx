"use client";

import { useMemo } from "react";
import {
  parseMarkdown,
  highlightText,
  applyMentionPills,
  type MentionRef,
} from "../lib/markdown";

interface FormattedTextProps {
  text: string;
  className?: string;
  highlightQuery?: string;
  mentions?: MentionRef[];
  currentUserId?: string;
}

export function FormattedText({
  text,
  className,
  highlightQuery,
  mentions,
  currentUserId,
}: FormattedTextProps) {
  const html = useMemo(() => {
    let result = parseMarkdown(text);
    // Order: pills first, then highlight. Pills wrap text segments in spans;
    // the search highlighter splits by tags and re-scans text, so it'll find
    // a query match inside a pill (e.g. searching "alice" still highlights
    // the "alice" portion of "@alice"). Reverse order would let the <mark>
    // tag split "@" from "alice" and break the pill regex.
    if (mentions && mentions.length > 0) {
      result = applyMentionPills(result, mentions, currentUserId);
    }
    if (highlightQuery) {
      result = highlightText(result, highlightQuery);
    }
    return result;
  }, [text, highlightQuery, mentions, currentUserId]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
