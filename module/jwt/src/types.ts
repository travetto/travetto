import * as jws from 'jws';

export type AlgType = jws.Header['alg'];

interface PayloadCore {
  iss?: string;
  sub?: string;
  jti?: string;
  iat?: number;
  exp?: number;
  nbf?: number;
  kid?: string;
}

export interface Payload extends PayloadCore {
  aud?: string | string[];
  [key: string]: string | number | string[] | object | undefined;
}

export interface TypedSig<T extends Payload = Payload> extends jws.Signature {
  payload: T;
}

export type Key = string | Buffer | Promise<string | Buffer>;

export type VerifyOptions = {
  clock?: { timestamp?: number | Date, tolerance?: number };
  ignore?: { exp?: boolean, nbf?: boolean };
  maxAgeSec?: number;
  header?: { [key: string]: string }
  key?: Key;
  encoding?: string;
  alg?: AlgType | AlgType[];

  payload?: {
    aud?: string | RegExp | (string | RegExp)[];
  } & PayloadCore
};

export interface SignHeader {
  alg?: AlgType;
  typ?: 'JWT';
}

export interface SignOptions {
  key?: Key;
  iatExclude?: boolean;
  alg?: AlgType;
  header?: {
    typ?: 'JWT';
  } & {
    [key: string]: string
  };
  encoding?: string;
}