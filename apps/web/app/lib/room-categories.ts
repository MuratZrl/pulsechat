const CATEGORIES_KEY = "chat_room_categories";
const CATEGORY_LIST_KEY = "chat_category_list";

const DEFAULT_CATEGORIES = ["General", "Work", "Gaming", "Social"];

// Default room-to-category mapping
const DEFAULT_ROOM_CATEGORIES: Record<string, string> = {
  "room-1": "General",
  "room-2": "Social",
};

function loadCategoryMap(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_ROOM_CATEGORIES;
  const stored = localStorage.getItem(CATEGORIES_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_ROOM_CATEGORIES;
}

function saveCategoryMap(map: Record<string, string>) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(map));
}

export function getCategories(): string[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  const stored = localStorage.getItem(CATEGORY_LIST_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_CATEGORIES;
}

export function addCategory(name: string): string[] {
  const cats = getCategories();
  if (!cats.includes(name)) {
    cats.push(name);
    localStorage.setItem(CATEGORY_LIST_KEY, JSON.stringify(cats));
  }
  return cats;
}

export function getRoomCategory(roomId: string): string {
  const map = loadCategoryMap();
  return map[roomId] || "General";
}

export function setRoomCategory(roomId: string, category: string): void {
  const map = loadCategoryMap();
  map[roomId] = category;
  saveCategoryMap(map);
}
