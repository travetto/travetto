import { RootRegistry } from '@travetto/registry';

import { validate } from './person-binding-invalid.ts';

export async function main(): Promise<void> {
  await RootRegistry.init();

  try {
    await validate();
  } catch (err) {
    console.warn!('Validation Failed', JSON.stringify(err, null, 2));
  }
}