import { SchemaValidator } from '@travetto/schema';
import { LocationAware } from './custom-type-usage';

export async function main(): Promise<void> {
  const la = LocationAware.from({
    name: 'bob',
    // @ts-ignore
    point: 'red'
  });

  try {
    await SchemaValidator.validate(LocationAware, la);
  } catch (err) {
    console.warn!('Validation Failed', JSON.stringify(err, null, 2));
  }
}