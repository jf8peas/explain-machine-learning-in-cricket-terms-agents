// The old links (app-specific, pure): the five-tab page's anchors still land somewhere sensible on the one-page layout, so a link
// that was shared or bookmarked keeps working. The data one also opens the Scorebook's data panel.
export interface Target {
  /** The anchor on this page to go to. */
  hash: string;
  /** A Scorebook panel to open there. */
  panel?: "data";
}

export const OLD_ANCHORS: Record<string, Target> = {
  "#working": { hash: "#watch" },
  "#found": { hash: "#verdict" },
  "#final-test": { hash: "#verdict" },
  "#try-your-own": { hash: "#try" },
  "#data": { hash: "#scorebook", panel: "data" },
};

/** Where an old anchor now goes, or null for any other hash (including the new ones). */
export function resolveAnchor(hash: string): Target | null {
  return OLD_ANCHORS[hash] ?? null;
}
