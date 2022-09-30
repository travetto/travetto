import { AppCache } from '@travetto/boot/src/cache';

/**
 * Clean cache
 */
export async function main(): Promise<void> {
  AppCache.clear();
}