import { TranspileCache } from '@travetto/boot/src/internal/transpile-cache';

/**
 * Clean cache
 */
export async function main(): Promise<void> {
  TranspileCache.clear();
}