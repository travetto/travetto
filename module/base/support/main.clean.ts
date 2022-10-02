import { ModuleCompileCache } from '@travetto/boot/src/internal/module-cache';

/**
 * Clean cache
 */
export async function main(): Promise<void> {
  ModuleCompileCache.clear();
}