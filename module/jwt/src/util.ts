import * as jws from 'jws';

import { JWTError } from './error';
import { Payload, SignOptions, SignHeader, TypedSig, VerifyOptions } from './types';
import { JWTVerifier } from './verify';

export class JWTUtil {
  /**
   * Sign the payload and return a token
   */
  static async create<T extends Payload>(payload: T, options: SignOptions = {}): Promise<string> {
    const header: SignHeader = {
      alg: options.alg ?? 'HS256',
      typ: 'JWT',
      ...options.header
    };

    payload = { ...payload };

    const now = Math.trunc(Date.now() / 1000);

    if (options.iatExclude) {
      delete payload.iat;
    } else {
      payload.iat ??= now;
    }

    let privateKey: string | Buffer = '';

    if (options.key) {
      privateKey = await options.key;
    }

    const opts = {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      header: header as jws.Header,
      privateKey,
      payload: JSON.stringify(payload),
      encoding: options.encoding || 'utf8'
    };

    try {
      return jws.sign(opts);
    } catch (err) {
      throw new JWTError(err instanceof Error ? err.message : `${err}`);
    }
  }

  /**
   * Read and return full object with signatures
   */
  static read<T extends Payload = Payload>(jwt: string): TypedSig<T> {

    // In lieu of splitting
    const pos1 = jwt.indexOf('.');
    const pos2 = jwt.indexOf('.', pos1 + 1);
    const pos3 = jwt.indexOf('.', pos2 + 1);

    if (pos1 < 0 || pos2 < 0 || pos3 > 0) {
      throw new JWTError('malformed token');
    }

    const decoded: TypedSig<T> = jws.decode(jwt);

    if (!decoded) {
      throw new JWTError('invalid token', { token: jwt });
    }

    if (typeof decoded.payload === 'string' && /^[{\[]/.test(decoded.payload)) {
      try {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        decoded.payload = JSON.parse(decoded.payload as 'string');
      } catch { }
    }

    return decoded;
  }

  /**
   * Verify the token
   */
  static async verify<T>(jwt: string, options: VerifyOptions = {}): Promise<Payload & T> {

    const key = await options.key;

    const { header, signature, payload } = this.read<Payload & T>(jwt);

    JWTVerifier.verifyHeader(header, signature, key, options);

    const valid = jws.verify(jwt, header.alg, key ?? '');

    if (!valid) {
      throw new JWTError('Token has invalid signature', {}, 'permissions');
    }

    JWTVerifier.verifyTypes(payload);
    JWTVerifier.verifyTimes(payload, options);
    JWTVerifier.verifyContext(payload, options);

    return payload;
  }
}