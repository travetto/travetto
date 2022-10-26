import * as fs from 'fs/promises';
import * as path from 'path';

type TimeEntry<T> = { key: string, data: T, time: number };

/**
 * Storage manager
 */
export class ActionStorage<T> {

  /**
   * Local storage
   */
  #storage: Record<string, TimeEntry<T>> = {};

  constructor(public scope: string, public root: string) {
    this.init();
  }

  /**
   * Load configuration
   */
  get resolved(): string {
    return path.resolve(this.root, `.trv.${this.scope}.json`).__posix;
  }

  /**
   * Initialize
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.root, { recursive: true });

      this.#storage = JSON.parse(await fs.readFile(this.resolved, 'utf8'));
    } catch {
      await this.persist();
    }
  }

  reset(): Promise<void> {
    this.#storage = {};
    return this.persist();
  }

  async persist(): Promise<void> {
    await fs.writeFile(this.resolved, JSON.stringify(this.#storage), 'utf8');
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