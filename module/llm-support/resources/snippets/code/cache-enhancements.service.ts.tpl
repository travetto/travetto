import { Injectable } from '@travetto/di';

@Injectable()
export class CacheableService {
  private readonly cache = new Map<string, string>();

  getOrPopulate(key: string, producer: () => string): string {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = producer();
    this.cache.set(key, value);
    return value;
  }
}
