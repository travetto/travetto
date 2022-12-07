import { RootRegistry } from '@travetto/registry';
import { validate } from '@travetto/schema/doc/person-binding-invalid';

export async function main(): Promise<void> {
  await RootRegistry.init();

  try {
    await validate();
  } catch (err) {
    console.warn!('Validation Failed', JSON.stringify(err, null, 2));
  }
}