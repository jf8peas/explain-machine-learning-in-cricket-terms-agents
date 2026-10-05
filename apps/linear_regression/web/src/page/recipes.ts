// The browser's interpreter for the declarative recipes in the feature catalogue. The same recipes are read by the
// data preparation script and the backend (Python); a shared fixture test keeps the two interpreters identical.
export type Recipe =
  | { difference: { from: number | string; of: string } }
  | { product: [string, string] }
  | { indicator: { column: string; equals: string | number } };

export type Values = Record<string, number | string>;

export class RecipeError extends Error {}

const num = (values: Values, column: string): number => {
  const v = values[column];
  if (v === undefined || v === null || typeof v === "string") throw new RecipeError(`the recipe needs the number ${column}`);
  return v;
};

export function isRecipe(source: Record<string, unknown>): source is Recipe {
  return "difference" in source || "product" in source || "indicator" in source;
}

export function evaluate(recipe: Recipe, values: Values): number {
  if ("difference" in recipe) {
    const { from, of } = recipe.difference;
    return (typeof from === "string" ? num(values, from) : from) - num(values, of);
  }
  if ("product" in recipe) return num(values, recipe.product[0]) * num(values, recipe.product[1]);
  const { column, equals } = recipe.indicator;
  if (!(column in values)) throw new RecipeError(`the recipe needs ${column}`);
  return values[column] === equals ? 1 : 0;
}

export interface CatalogueSource {
  id: string;
  source: Record<string, unknown>;
}

/** Every derived feature that can be computed from `base`, in catalogue order (earlier ones feed later ones). */
export function deriveAll(catalogue: CatalogueSource[], base: Values): Record<string, number> {
  const values: Values = { ...base };
  const derived: Record<string, number> = {};
  for (const f of catalogue) {
    if (!isRecipe(f.source)) continue;
    try {
      derived[f.id] = values[f.id] = evaluate(f.source, values);
    } catch (err) {
      if (!(err instanceof RecipeError)) throw err; // a needed input was not given: leave this one out
    }
  }
  return derived;
}
