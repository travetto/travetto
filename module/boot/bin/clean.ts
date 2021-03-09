import { AppCache } from '../src/cache';

/**
 * Clean cache
 */
export async function main() {
  AppCache.clear();
}