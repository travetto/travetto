import { RootRegistry } from '@travetto/registry';
import { SchemaValidator } from '@travetto/schema';
import { LocationAware } from '@travetto/schema/doc/custom-type-usage';

export async function main(): Promise<void> {
  await RootRegistry.init();

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