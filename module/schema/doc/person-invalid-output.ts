import { RegistryV2 } from '@travetto/registry';

import { validate } from './person-binding-invalid.ts';

export async function main(): Promise<void> {
  await RegistryV2.init();

  try {
    await validate();
  } catch (err) {
    console.warn!('Validation Failed', JSON.stringify(err, null, 2));
  }
}