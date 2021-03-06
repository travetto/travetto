import { PhaseManager } from '@travetto/base';

export async function main() {
  await PhaseManager.run('init');

  const { validate } = await import('./person-binding-invalid');

  try {
    await validate();
  } catch (err) {
    console.warn!('Validation Failed', JSON.stringify(err, null, 2));
  }
}