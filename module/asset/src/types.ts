import { StreamMeta } from '@travetto/model';

/**
 * A retrieval/storable asset
 *
 * @concrete ./internal/types:AssetImpl
 */
export interface Asset extends StreamMeta {
  stream: NodeJS.ReadableStream;
}