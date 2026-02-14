import { consumeError } from './rpc.ts';

export async function toNodeError(payload: unknown): Promise<Error> {
  try {
    let result = undefined;
    const { AppError } = await import('@travetto/runtime');
    if (AppError.isJSON(result)) {
      result = AppError.fromJSON(result) ?? result;
    }
    if (result) {
      return result;
    }
  } catch { }
  return consumeError(payload);
}