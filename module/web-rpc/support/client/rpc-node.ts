import { consumeError } from './rpc.ts';

export async function toNodeError(payload: unknown): Promise<Error> {
  try {
    const { AppError } = await import('@travetto/runtime');
    if (AppError.isJSON(payload)) {
      return AppError.fromJSON(payload);
    }
  } catch { }
  return consumeError(payload);
}