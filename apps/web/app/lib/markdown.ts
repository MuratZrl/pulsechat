// Lightweight markdown parser — no dependencies
// Supports: **bold**, *italic*, ~~strikethrough~~, `code`, ```code blocks```, > blockquotes, [links](url)

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:"]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeHttpUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return ALLOWED_LINK_PROTOCOLS.has(u.protocol);
  } catch {
    return false;
  }
}

export function parseMarkdown(text: string): string {
  // Escape HTML
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Extract code blocks into placeholders
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre class="md-pre"><code>${code.replace(/\n$/, "")}</code></pre>`
    );
    return `__CODE_BLOCK_${idx}__`;
  });

  // Extract inline code into placeholders
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code class="md-code">${code}</code>`);
    return `__INLINE_CODE_${idx}__`;
  });

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Links — only http(s) protocols allowed; anything else falls back to escaped plain text
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    if (!isSafeHttpUrl(url)) {
      return `[${escapeHtml(label)}](${escapeHtml(url)})`;
    }
    return `<a class="md-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Blockquotes (lines starting with >)
  html = html.replace(
    /^&gt;\s?(.*)$/gm,
    '<blockquote class="md-quote">$1</blockquote>'
  );

  // Restore inline code
  inlineCodes.forEach((code, idx) => {
    html = html.replace(`__INLINE_CODE_${idx}__`, code);
  });

  // Restore code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  // Convert newlines to <br> (except inside pre blocks)
  html = html.replace(
    /(?<!<\/pre>)\n(?!<pre)/g,
    "<br>"
  );

  return html;
}

export function highlightText(html: string, query: string): string {
  if (!query || query.length < 1) return html;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Split by HTML tags, only highlight in text segments
  const parts = html.split(/(<[^>]+>)/);
  return parts
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part.replace(
        new RegExp(`(${escaped})`, "gi"),
        '<mark class="md-highlight">$1</mark>'
      );
    })
    .join("");
}
