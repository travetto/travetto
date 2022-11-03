import { validate } from './person-binding-invalid';

export async function main(): Promise<void> {
  try {
    await validate();
  } catch (err) {
    console.warn!('Validation Failed', JSON.stringify(err, null, 2));
  }
}