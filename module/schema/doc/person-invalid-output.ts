import { Registry } from '@travetto/registry';
import { JSONUtil } from '@travetto/runtime';

import { validate } from './person-binding-invalid.ts';

export async function main(): Promise<void> {
  await Registry.init();

  try {
    await validate();
  } catch (error) {
    console.warn!('Validation Failed', JSONUtil.toUTF8Pretty(error));
  }
}