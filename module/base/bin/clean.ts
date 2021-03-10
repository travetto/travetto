import { AppCache } from '@travetto/boot/src/cache';

/**
 * Clean cache
 */
export async function main() {
  AppCache.clear();
}