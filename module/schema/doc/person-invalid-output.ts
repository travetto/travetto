import { Registry } from '@travetto/registry';

import { validate } from './person-binding-invalid.ts';

export async function main(): Promise<void> {
  await Registry.init();

  try {
    await validate();
  } catch (error) {
    console.warn!('Validation Failed', JSON.stringify(error, null, 2));
  }
}