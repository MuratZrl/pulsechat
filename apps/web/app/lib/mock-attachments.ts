import { Attachment } from "../types";

const imgPlaceholder = (color: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect fill="${color}" width="200" height="140" rx="8"/><text x="100" y="75" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="14">${label}</text></svg>`)}`;

export const DEMO_ATTACHMENTS: Attachment[] = [
  {
    name: "screenshot.png",
    type: "image",
    size: "1.2 MB",
    url: imgPlaceholder("#6366f1", "Screenshot"),
  },
  {
    name: "design-mockup.png",
    type: "image",
    size: "3.4 MB",
    url: imgPlaceholder("#8b5cf6", "Mockup"),
  },
  {
    name: "project-spec.pdf",
    type: "file",
    size: "842 KB",
  },
  {
    name: "meeting-notes.docx",
    type: "file",
    size: "124 KB",
  },
  {
    name: "api-docs.zip",
    type: "file",
    size: "5.1 MB",
  },
];
