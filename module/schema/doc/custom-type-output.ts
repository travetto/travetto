import { Registry } from '@travetto/registry';
import { SchemaValidator } from '@travetto/schema';

import { LocationAware } from './custom-type-usage.ts';

export async function main(): Promise<void> {
  await Registry.init();

  const la = LocationAware.from({
    name: 'bob',
    // @ts-expect-error
    point: 'red'
  });

  try {
    await SchemaValidator.validate(LocationAware, la);
  } catch (error) {
    console.warn!('Validation Failed', JSON.stringify(error, null, 2));
  }
}