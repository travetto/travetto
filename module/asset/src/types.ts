import { Readable } from 'node:stream';

import { StreamMeta } from '@travetto/model';

/**
 * An asset, for storage
 *
 * @concrete ./internal/types#AssetImpl
 */
export interface Asset extends StreamMeta {
  source: Readable | string | Buffer;
  localFile?: string;
}

/**
 * An asset response
 */
export interface AssetResponse extends StreamMeta {
  stream(): Readable;
  /**
   * Response byte range, inclusive
   */
  range?: [start: number, end: number];
}