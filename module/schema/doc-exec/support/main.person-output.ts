import { RootRegistry } from '@travetto/registry';
import { Test } from '@travetto/schema/doc/person-binding';

export async function main(): Promise<void> {
  await RootRegistry.init();

  console.log!(Test());
}