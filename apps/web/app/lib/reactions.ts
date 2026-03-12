// Reactions are now handled via Socket.io (toggle_reaction / reaction_updated)
// and stored server-side. This file only exports the type.
export type Reactions = Record<string, string[]>; // emoji -> userIds[]
