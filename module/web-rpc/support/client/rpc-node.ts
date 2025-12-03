import { consumeError } from './rpc.ts';

export async function toNodeError(payload: unknown): Promise<Error> {
  try {
    let result = undefined;
    const { AppError } = await import('@travetto/runtime');
    result = AppError.fromJSON(payload);
    if (result) {
      return result;
    }
  } catch { }
  return consumeError(payload);
}