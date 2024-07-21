import vscode from 'vscode';

type TimeEntry<T> = { key: string, data: T, time: number };

/**
 * Storage manager
 */
export class ActionStorage<T> {

  /**
   * Local storage
   */
  #storage: Record<string, TimeEntry<T>> = {};
  #context: vscode.ExtensionContext;
  #scope: string;

  constructor(scope: string, context: vscode.ExtensionContext) {
    this.#context = context;
    this.#scope = scope;
    this.init(); // Kick off
  }

  reset(): Promise<void> {
    this.#storage = {};
    return this.persist();
  }

  async init(): Promise<void> {
    const val = await this.#workspaceState.get<Record<string, TimeEntry<T>>>(`${this.#scope}.storage`);
    this.#storage = val ?? {};
  }

  async persist(): Promise<void> {
    await this.#workspaceState.update(`${this.#scope}.storage`, this.#storage);
  }

  /**
   * Set value
   * @param key
   * @param value
   */
  async set(key: string, value?: T): Promise<void> {
    if (value) {
      this.#storage[key] = { key, data: value, time: Date.now() };
    } else {
      delete this.#storage[key];
    }
    return this.persist(); // Don't wait
  }

  /**
   * Check value
   * @param key
   */
  has(key: string): boolean {
    return key in this.#storage;
  }

  /**
   * Get value
   * @param key
   */
  get(key: string): T & { time: number } {
    const ent = this.#storage[key];
    return { ...ent.data, time: ent.time };
  }

  /**
   * Get most recent values
   * @param size
   */
  getRecent(size = 5): TimeEntry<T>[] {
    return Object.values(this.#storage)
      .sort((a, b) => b.time - a.time)
      .slice(0, size);
  }

  /**
   * Get recent and filter out stale data
   * @param size
   * @param remove
   */
  getRecentAndFilterState(size: number, remove: (x: T) => boolean): TimeEntry<T>[] {
    return this.getRecent(size)
      .filter(x => {
        if (remove(x.data)) {
          this.set(x.key!);
        }
        return x;
      });
  }
}