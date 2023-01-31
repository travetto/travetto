import { RootRegistry } from '@travetto/registry';
import { Test } from './person-binding';

export async function main(): Promise<void> {
  await RootRegistry.init();

  console.log!(Test());
}