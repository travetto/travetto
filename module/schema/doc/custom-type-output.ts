import { PhaseManager } from '@travetto/base';

export async function main() {
  await PhaseManager.run('init');

  const { LocationAware } = await import('./custom-type-usage');
  const { SchemaValidator } = await import('../src/validate/validator');

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