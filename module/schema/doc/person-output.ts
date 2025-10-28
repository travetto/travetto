import { RegistryV2 } from '@travetto/registry';
import { Test } from './person-binding.ts';

export async function main(): Promise<void> {
  await RegistryV2.init();

  console.log!(Test());
}