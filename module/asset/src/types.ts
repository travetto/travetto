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