// Tiny helpers for building DOM from data. Everything goes in as text, never as HTML, so a language model's wording
// (or anything else from the server) can never become markup.
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

export const fmt = (n: number, digits = 1): string => n.toFixed(digits);
