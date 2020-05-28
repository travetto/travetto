import * as jws from 'jws';

export type AlgType = jws.Header['alg'];

/**
 * Root of the payload
 */
interface PayloadCore {
  /**
   * Issuer
   */
  iss?: string;
  /**
   * Subject
   */
  sub?: string;
  /**
   * JWT Token Id
   */
  jti?: string;
  /**
   * Issued at time in seconds
   */
  iat?: number;
  /**
   * Expiry timestamp in seconds
   */
  exp?: number;
  /**
   * Not before timestamp
   */
  nbf?: number;
  /**
   * Key id
   */
  kid?: string;
}

/**
 * The full payload
 */
export interface Payload extends PayloadCore {
  /**
   * List of audiences
   */
  aud?: string | string[];
  /**
   * Extra properties on the payload
   */
  [key: string]: string | number | string[] | object | undefined;
}

export interface TypedSig<T extends Payload = Payload> extends jws.Signature {
  /**
   * Actual payload
   */
  payload: T;
}

export type Key = string | Buffer | Promise<string | Buffer>;

/**
 * Verification options
 */
export type VerifyOptions = {
  /**
   * Clock starting point
   */
  clock?: {
    /**
     * Time to check against
     */
    timestamp?: number | Date;
    /**
     * Time tolerance
     */
    tolerance?: number;
  };
  /**
   * Ignore various checks
   */
  ignore?: {
    /**
     * Ignore expiration time
     */
    exp?: boolean;
    /**
     * Ignore not before timestamp
     */
    nbf?: boolean;
  };
  /**
   * Max age in seconds
   */
  maxAgeSec?: number;
  /**
   * Header
   */
  header?: Record<string, string>;
  /**
   * Encryption key
   */
  key?: Key;
  /**
   * Encoding
   */
  encoding?: string;
  /**
   * Algorithms to use
   */
  alg?: AlgType | AlgType[];

  /**
   * Payload audience to check
   */
  payload?: {
    aud?: string | RegExp | (string | RegExp)[];
  } & PayloadCore;
};

/**
 * Sign header
 */
export interface SignHeader {
  alg?: AlgType;
  typ?: 'JWT';
}

/**
 * Signing options
 */
export interface SignOptions {
  /**
   * Key to use
   */
  key?: Key;
  /**
   * Ignore issued
   */
  iatExclude?: boolean;
  /**
   * Algorithm
   */
  alg?: AlgType;
  /**
   * Header type
   */
  header?: {
    typ?: 'JWT';
  } & {
    [key: string]: string;
  };
  /**
   * Encoding for key
   */
  encoding?: string;
}