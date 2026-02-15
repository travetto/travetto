import { consumeError } from './rpc.ts';

export async function toNodeError(payload: unknown): Promise<Error> {
  try {
    const { JSONUtil } = await import('@travetto/runtime');
    if (JSONUtil.isJSONError(payload)) {
      return JSONUtil.jsonErrorToError(payload);
    }
  } catch { }
  return consumeError(payload);
}