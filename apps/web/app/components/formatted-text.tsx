"use client";

import { useMemo } from "react";
import { parseMarkdown, highlightText } from "../lib/markdown";

interface FormattedTextProps {
  text: string;
  className?: string;
  highlightQuery?: string;
}

export function FormattedText({ text, className, highlightQuery }: FormattedTextProps) {
  const html = useMemo(() => {
    let result = parseMarkdown(text);
    if (highlightQuery) {
      result = highlightText(result, highlightQuery);
    }
    return result;
  }, [text, highlightQuery]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
