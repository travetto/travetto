import { Registry } from '@travetto/registry';
import { Test } from './person-binding.ts';

export async function main(): Promise<void> {
  await Registry.init();

  console.log!(Test());
}