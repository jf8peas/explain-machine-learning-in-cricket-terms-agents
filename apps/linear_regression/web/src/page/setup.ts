// A setup in words (app-specific, pure): chips for the parts of a setup other than its features, and the check errors
// labelled by year. Every label comes from the menus the server sends with the catalogue; nothing is typed here.
export interface MenuOption { id: string; label: string }
export interface Menus { window: MenuOption[]; weighting: MenuOption[]; training_innings: MenuOption[] }
export type MenuName = keyof Menus;
export type Labeller = (menu: MenuName, id: string) => string;

export interface SetupLike {
  features: string[];
  window?: string | null;
  weighting?: string | null;
  training_innings?: string | null;
}
export interface Chip { part: MenuName; text: string }
export interface CheckError { year: number; mae: number }

const PARTS: MenuName[] = ["window", "weighting", "training_innings"];

/** The menu's wording for an option id; the id itself while the menus have not arrived or if the id is not on the menu. */
export function menuLabeller(menus: Menus | undefined): Labeller {
  return (menu, id) => menus?.[menu]?.find((o) => o.id === id)?.label ?? id;
}

/** One chip for each part of the setup that is there, in the order window, weighting, training innings. */
export function setupChips(setup: SetupLike, label: Labeller): Chip[] {
  return PARTS.filter((part) => typeof setup[part] === "string").map((part) => ({ part, text: label(part, setup[part] as string) }));
}

/** "2023: 17.0" for each check, to one decimal. */
export function checkLabels(checks: CheckError[] | undefined): string[] {
  return (checks ?? []).map((c) => `${c.year}: ${c.mae.toFixed(1)}`);
}
