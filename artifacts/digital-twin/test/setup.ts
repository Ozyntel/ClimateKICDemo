/** Minimal in-memory localStorage + window for store tests (node environment). */
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
const g = globalThis as unknown as { localStorage: Storage; window: EventTarget & { localStorage?: Storage } };
g.localStorage = new MemoryStorage();
if (!("window" in g) || !g.window) g.window = Object.assign(new EventTarget(), { localStorage: g.localStorage }) as never;
