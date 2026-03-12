export interface MockGif {
  id: string;
  title: string;
  url: string;
  category: string;
  color: string;
}

const mockGifs: MockGif[] = [
  // Reactions
  { id: "gif-1", title: "Thumbs Up", url: "", category: "Reactions", color: "#4ade80" },
  { id: "gif-2", title: "Clapping", url: "", category: "Reactions", color: "#facc15" },
  { id: "gif-3", title: "Mind Blown", url: "", category: "Reactions", color: "#f87171" },
  { id: "gif-4", title: "Shocked Face", url: "", category: "Reactions", color: "#60a5fa" },
  { id: "gif-5", title: "Eye Roll", url: "", category: "Reactions", color: "#a78bfa" },
  // Funny
  { id: "gif-6", title: "LOL Dancing", url: "", category: "Funny", color: "#fb923c" },
  { id: "gif-7", title: "Facepalm", url: "", category: "Funny", color: "#e879f9" },
  { id: "gif-8", title: "Confused Math", url: "", category: "Funny", color: "#2dd4bf" },
  { id: "gif-9", title: "Awkward Look", url: "", category: "Funny", color: "#f472b6" },
  { id: "gif-10", title: "Deal With It", url: "", category: "Funny", color: "#34d399" },
  // Love
  { id: "gif-11", title: "Heart Eyes", url: "", category: "Love", color: "#fb7185" },
  { id: "gif-12", title: "Sending Love", url: "", category: "Love", color: "#f43f5e" },
  { id: "gif-13", title: "Cute Hug", url: "", category: "Love", color: "#ec4899" },
  { id: "gif-14", title: "Kiss", url: "", category: "Love", color: "#e11d48" },
  { id: "gif-15", title: "Blowing Kiss", url: "", category: "Love", color: "#db2777" },
  // Celebrate
  { id: "gif-16", title: "Party Popper", url: "", category: "Celebrate", color: "#8b5cf6" },
  { id: "gif-17", title: "Confetti", url: "", category: "Celebrate", color: "#a855f7" },
  { id: "gif-18", title: "Fireworks", url: "", category: "Celebrate", color: "#6366f1" },
  { id: "gif-19", title: "Dance Party", url: "", category: "Celebrate", color: "#c084fc" },
  { id: "gif-20", title: "Cheers", url: "", category: "Celebrate", color: "#7c3aed" },
];

export const GIF_CATEGORIES = ["All", "Reactions", "Funny", "Love", "Celebrate"];

export function getGifs(category?: string, query?: string): MockGif[] {
  let results = mockGifs;

  if (category && category !== "All") {
    results = results.filter((g) => g.category === category);
  }

  if (query) {
    const q = query.toLowerCase();
    results = results.filter((g) => g.title.toLowerCase().includes(q));
  }

  return results;
}
