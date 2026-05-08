// GIPHY v1 API client. Keyed via NEXT_PUBLIC_GIPHY_API_KEY (sign up at
// https://developers.giphy.com).
//
// `rating=pg-13` is hardcoded so the picker can't surface NSFW content in a
// portfolio app. No client-side caching — GIPHY's terms discourage caching
// beyond the request lifetime, and the project's storage constraints disallow
// localStorage/sessionStorage anyway.

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";
const RATING = "pg-13";
const PAGE_LIMIT = 24;

export interface GiphyGif {
  id: string;
  title: string;
  url: string;        // original.url — used when the user picks a GIF
  previewUrl: string; // fixed_width_small.url — used in the picker grid
  width: number;
  height: number;
}

export interface GiphyPage {
  results: GiphyGif[];
  totalCount: number;
  offset: number;
  count: number;
}

interface RawGiphyImage {
  url: string;
  width: string;
  height: string;
}

interface RawGiphyResult {
  id: string;
  title: string;
  images: {
    fixed_width_small?: RawGiphyImage;
    original?: RawGiphyImage;
  };
}

interface RawGiphyResponse {
  data: RawGiphyResult[];
  pagination: {
    total_count: number;
    count: number;
    offset: number;
  };
}

function getApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  return key && key.length > 0 ? key : null;
}

export function isGiphyConfigured(): boolean {
  return getApiKey() !== null;
}

function buildUrl(path: string, params: Record<string, string>): string {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GIPHY API key not configured");
  const url = new URL(`${GIPHY_BASE}/${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("rating", RATING);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

function shapeResult(raw: RawGiphyResult): GiphyGif | null {
  const orig = raw.images.original;
  const tiny = raw.images.fixed_width_small;
  // Drop entries missing either rendition rather than crashing the grid.
  if (!orig || !tiny) return null;
  return {
    id: raw.id,
    title: raw.title || "GIF",
    url: orig.url,
    previewUrl: tiny.url,
    width: parseInt(orig.width, 10) || 0,
    height: parseInt(orig.height, 10) || 0,
  };
}

function shapePage(raw: RawGiphyResponse): GiphyPage {
  return {
    results: raw.data
      .map(shapeResult)
      .filter((g): g is GiphyGif => g !== null),
    totalCount: raw.pagination.total_count,
    offset: raw.pagination.offset,
    count: raw.pagination.count,
  };
}

export async function fetchTrending(offset = 0): Promise<GiphyPage> {
  const url = buildUrl("trending", {
    limit: String(PAGE_LIMIT),
    offset: String(offset),
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIPHY /trending: ${res.status}`);
  return shapePage((await res.json()) as RawGiphyResponse);
}

export async function searchGifs(query: string, offset = 0): Promise<GiphyPage> {
  const url = buildUrl("search", {
    q: query,
    limit: String(PAGE_LIMIT),
    offset: String(offset),
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIPHY /search: ${res.status}`);
  return shapePage((await res.json()) as RawGiphyResponse);
}

// Hardcoded preset categories used as one-tap search queries. The /categories
// endpoint exists but returns more options than fit comfortably in the
// 320px-wide picker — five presets is what Discord uses and what the original
// mock had.
export const PRESET_CATEGORIES = [
  "Reactions",
  "Funny",
  "Love",
  "Celebrate",
  "Sports",
] as const;
