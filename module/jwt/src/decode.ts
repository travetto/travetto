import * as jws from 'jws';
import { TypedSig, Payload } from './types';
import { JWTError } from './common';

export function decodeComplete<T extends Payload = Payload>(jwt: string): TypedSig<T> {

  // In lieu of splitting
  const pos1 = jwt.indexOf('.');
  const pos2 = jwt.indexOf('.', pos1 + 1);
  const pos3 = jwt.indexOf('.', pos2 + 1);

  if (pos1 < 0 || pos2 < 0 || pos3 > 0) {
    throw new JWTError('malformed token');
  }

  const decoded = jws.decode(jwt) as TypedSig<T>;

  if (!decoded) {
    throw new JWTError('invalid token', { token: jwt });
  }

  if (typeof decoded.payload === 'string' && /^[{\[]/.test(decoded.payload)) {
    try {
      decoded.payload = JSON.parse(decoded.payload);
    } catch (e) { }
  }

  return decoded;
}

export function decode<T extends Payload = Payload>(jwt: string): T {
  return decodeComplete<T>(jwt).payload;
}