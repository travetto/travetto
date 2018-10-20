import * as jws from 'jws';

import { JWTError } from './common';
import { Payload, SignOptions, SignHeader } from './types';

export async function sign<T extends Payload>(payload: T, options: SignOptions = {}): Promise<string> {
  const header: SignHeader = {
    alg: options.alg || 'HS256',
    typ: 'JWT',
    ...options.header
  };

  payload = { ...(payload as object) } as T;

  const NOW = Math.trunc(Date.now() / 1000);

  if (!options.iatExclude) {
    if (!payload.iat) {
      payload.iat = NOW;
    }
  } else {
    delete payload.iat;
  }

  let privateKey: string | Buffer = '';

  if (options.key) {
    privateKey = await options.key;
  }

  const opts = {
    header: header as jws.Header,
    privateKey,
    payload: JSON.stringify(payload),
    encoding: options.encoding || 'utf8'
  };

  try {
    return jws.sign(opts);
  } catch (err) {
    throw new JWTError(err.message);
  }
}