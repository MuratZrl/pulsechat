// Markdown rendering: marked (CommonMark + GFM) for parsing, DOMPurify for
// sanitization. The link renderer is overridden so only http(s) URLs become
// real anchors — the rest fall back to escaped text. This preserves the
// PR 1 XSS fix on top of marked's grammar.

import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:"]);

function isSafeHttpUrl(href: string): boolean {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Configure marked once, at module load.
marked.setOptions({
  gfm: true,
  breaks: true, // single \n becomes <br>
});

const renderer = new marked.Renderer();

// Override link to enforce protocol whitelist + emit our existing CSS class.
// In marked v15+, the renderer receives { href, title, tokens } and exposes
// `this.parser` for inline rendering of the link text tokens.
renderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  if (!isSafeHttpUrl(href)) {
    return `[${text}](${escapeHtml(href)})`;
  }
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a class="md-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
};

// Keep the existing class names so app/globals.css's `.md-pre`, `.md-code`,
// `.md-quote` rules continue to apply without any CSS changes.
renderer.code = function ({ text }) {
  return `<pre class="md-pre"><code>${escapeHtml(text)}</code></pre>`;
};

renderer.codespan = function ({ text }) {
  // marked already escapes the text passed to codespan.
  return `<code class="md-code">${text}</code>`;
};

renderer.blockquote = function ({ tokens }) {
  return `<blockquote class="md-quote">${this.parser.parse(tokens)}</blockquote>`;
};

marked.use({ renderer });

export function parseMarkdown(text: string): string {
  const rawHtml = marked.parse(text, { async: false }) as string;

  // Note: ALLOWED_URI_REGEXP is intentionally NOT set. In DOMPurify v3 it
  // gets applied to non-URI attributes too (target, rel) and would strip
  // their values. Protocol filtering happens in two layers without it:
  //   1. The link renderer's isSafeHttpUrl rejects non-http(s) before HTML
  //      is generated.
  //   2. DOMPurify's default URI scheme allowlist still blocks javascript:,
  //      data:, vbscript: on any href that slipped through (e.g. raw HTML
  //      in the markdown source).
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "del", "code", "pre",
      "blockquote", "a", "ul", "ol", "li", "mark",
    ],
    ALLOWED_ATTR: ["href", "class", "target", "rel", "title"],
  });
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
