import { sign, Header, decode, verify } from 'jws';

import { TimeUtil } from '@travetto/base';

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

    const now = TimeUtil.asSeconds(Date.now());

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
      header: header as Header,
      privateKey,
      payload: JSON.stringify(payload),
      encoding: options.encoding || 'utf8'
    };

    try {
      return sign(opts);
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

    const decoded: TypedSig<T> | null = decode(jwt);

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
   * Rewrite a token with a simple transformation
   */
  static async rewrite<T extends Payload>(jwt: string, transformer: (o: T) => T, options: SignOptions = {}): Promise<string> {
    const { payload } = await this.read<T>(jwt);
    return await this.create(transformer(payload), options);
  }

  /**
   * Verify the token
   */
  static async verify<T>(jwt: string, options: VerifyOptions = {}): Promise<Payload & T> {

    const rawKey = await options.key;
    const keys = rawKey ? Array.isArray(rawKey) ? rawKey : [rawKey] : [];

    const { header, signature, payload } = this.read<Payload & T>(jwt);

    let valid = false;

    if (!keys.length || keys.length === 1) {
      JWTVerifier.verifyHeader(header, signature, keys[0], options);
      valid = verify(jwt, header.alg, keys[0] ?? '');
    } else {
      for (const key of keys) {
        JWTVerifier.verifyHeader(header, signature, key, options);
        valid = verify(jwt, header.alg, key ?? '');
        if (valid) {
          break;
        }
      }
    }

    if (!valid) {
      throw new JWTError('Token has invalid signature', {}, 'permissions');
    }

    JWTVerifier.verifyTypes(payload);
    JWTVerifier.verifyTimes(payload, options);
    JWTVerifier.verifyContext(payload, options);

    return payload;
  }
}