import { toError } from './rest-rpc';

export async function toNodeError(payload: unknown): Promise<Error> {
  try {
    let res = undefined;
    const { AppError } = await import('@travetto/runtime');
    res = AppError.fromJSON(payload);
    if (res) {
      return res;
    }
  } catch { }
  return toError(payload);
}