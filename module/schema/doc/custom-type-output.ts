import { RegistryV2 } from '@travetto/registry';
import { SchemaValidator } from '@travetto/schema';

import { LocationAware } from './custom-type-usage.ts';

export async function main(): Promise<void> {
  await RegistryV2.init();

  const la = LocationAware.from({
    name: 'bob',
    // @ts-expect-error
    point: 'red'
  });

  try {
    await SchemaValidator.validate(LocationAware, la);
  } catch (err) {
    console.warn!('Validation Failed', JSON.stringify(err, null, 2));
  }
}