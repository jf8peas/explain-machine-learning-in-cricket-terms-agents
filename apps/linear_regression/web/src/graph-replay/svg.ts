// A tiny helper to build SVG elements, shared by the graph drawing and the bands.
export const SVG_NS = "http://www.w3.org/2000/svg";

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
