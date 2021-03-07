import { LocationAware } from './custom-type-usage';
import { SchemaValidator } from '../src/validate/validator';

export async function main() {
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