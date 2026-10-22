import { describe, expect, it } from "vitest";
import { createStore, STORAGE_KEY, type StorageLike } from "../../src/detail-level/detail-level";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}
const blocked = (): StorageLike => { throw new Error("blocked"); };

describe("the remembered detail level", () => {
  it("starts simple", () => {
    expect(createStore(() => memoryStorage()).initial("")).toBe("simple");
  });

  it("reads the stored choice, which is how the other page learns it", () => {
    expect(createStore(() => memoryStorage({ [STORAGE_KEY]: "everything" })).initial("")).toBe("everything");
  });

  it("?view=everything wins over a stored simple and is remembered", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "simple" });
    const store = createStore(() => storage);
    expect(store.initial("?view=everything")).toBe("everything");
    expect(storage.data[STORAGE_KEY]).toBe("everything");
    expect(createStore(() => storage).initial("")).toBe("everything");
  });

  it("ignores an unknown view value and a stored value that is not a level", () => {
    expect(createStore(() => memoryStorage()).initial("?view=banana")).toBe("simple");
    expect(createStore(() => memoryStorage({ [STORAGE_KEY]: "junk" })).initial("")).toBe("simple");
  });

  it("remember writes to storage", () => {
    const storage = memoryStorage();
    createStore(() => storage).remember("everything");
    expect(storage.data[STORAGE_KEY]).toBe("everything");
  });

  it("works when storage throws: the choice lasts for the page", () => {
    const store = createStore(blocked);
    expect(store.initial("")).toBe("simple");
    expect(() => store.remember("everything")).not.toThrow();
    expect(store.initial("")).toBe("everything");           // from memory, within this page
    expect(createStore(blocked).initial("?view=everything")).toBe("everything");
  });

  it("a write that fails still leaves the page showing the choice", () => {
    const storage: StorageLike = { getItem: () => null, setItem: () => { throw new Error("full"); } };
    const store = createStore(() => storage);
    store.remember("everything");
    expect(store.initial("")).toBe("everything");
  });
});
