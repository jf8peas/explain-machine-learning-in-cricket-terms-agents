// The words on "How this app was built" that come from the server's glossary (feature 021): the brute-force search's definition
// (a sentence under the graph, a technical paragraph and an honest note in Commentary) and the "Words we use" list. The HTML holds
// the places (data-definition, data-glossary); the words are the server's, set as text.
import { NOT_AVAILABLE, allTerms, definition, type DefinitionKey } from "../terms";

const KEYS: DefinitionKey[] = ["brute_force", "brute_force_technical", "brute_force_honest"];

function row(plain: string, technical: string, meaning: string): HTMLElement {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "word-row");
  const dt = document.createElement("dt");
  dt.textContent = plain;
  const dd = document.createElement("dd");
  dd.textContent = `${technical}. ${meaning}`;
  div.append(dt, dd);
  return div;
}

export function fillWords(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-definition]")) {
    const key = el.dataset.definition as DefinitionKey;
    el.textContent = KEYS.includes(key) ? definition(key) : NOT_AVAILABLE;
  }
  const list = root.querySelector<HTMLElement>("[data-glossary]");
  const terms = allTerms();
  if (list && terms.length) {
    list.replaceChildren(...terms.map((t) => row(t.alt_plain ? `${t.plain} / ${t.alt_plain}` : t.plain, t.technical, t.meaning)));
  }
}

/** True once the visitor has scrolled, touched or pressed a key. Watched from the moment this file loads, before the page's data has arrived, so a
 *  visitor who moves on while it loads is not pulled back to the definition afterwards (issue 11). */
let visitorMoved = false;
for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) window.addEventListener(type, () => { visitorMoved = true; }, { once: true, passive: true });

/** A link to #brute-force lands on the definition even though its words (and the graph above it) arrive after the page: bring it into view and focus
 *  it, then do it again when the graph has been drawn or the page has loaded, because those push the definition down. Once the visitor has moved the
 *  page it is left alone. */
export function followDefinitionLink(): void {
  if (window.location.hash !== "#brute-force") return;
  const go = () => {
    const target = document.getElementById("brute-force");
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  };
  const again = () => { if (!visitorMoved && window.location.hash === "#brute-force") go(); };
  again();
  document.querySelector("graph-replay")?.addEventListener("structureready", again, { once: true });
  window.addEventListener("load", again, { once: true });
  window.setTimeout(again, 2000);   // a slow connection that neither event covers
}
