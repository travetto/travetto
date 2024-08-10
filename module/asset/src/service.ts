import { PassThrough, Readable } from 'node:stream';

import { Inject, Injectable } from '@travetto/di';
import { ModelStreamSupport, ExistsError, NotFoundError, StreamMeta, StreamRange } from '@travetto/model';
import { enforceRange } from '@travetto/model/src/internal/service/stream';

import { Asset } from './types';
import { AssetNamingStrategy, SimpleNamingStrategy } from './naming';
import { AssetUtil } from './util';
import { StreamResponse } from './response';

export const AssetModelⲐ = Symbol.for('@travetto/asset:model');

/**
 * Services asset CRUD operations.  Takes in a source is defined elsewhere.
 * Additionally supports a naming strategy that allows for translation of names
 * to and from the asset source.
 */
@Injectable()
export class AssetService {

  #store: ModelStreamSupport;
  #namingStrategy: AssetNamingStrategy;

  constructor(@Inject(AssetModelⲐ, { resolution: 'loose' }) store: ModelStreamSupport,
    namingStrategy?: AssetNamingStrategy
  ) {
    this.#namingStrategy = namingStrategy ?? new SimpleNamingStrategy();
    this.#store = store;
  }

  /**
   * Delete a given location
   * @param location The location to an asset
   */
  delete(location: string): Promise<void> {
    return this.#store.deleteStream(location);
  }

  /**
   * Get the asset info
   * @param location The location to get metadata for
   */
  describe(location: string): Promise<StreamMeta> {
    return this.#store.describeStream(location);
  }

  /**
   * Stores an asset with the optional ability to overwrite if the file is already found. If not
   * overwriting and file exists, an error will be thrown.
   *
   * @param blob The blob to store
   * @param meta The optional metadata for the blob
   * @param overwriteIfFound Overwrite the asset if found
   * @param strategy The naming strategy to use, defaults to the service's strategy if not provided
   */
  async upsertBlob(blob: Blob, meta: Partial<StreamMeta> = {}, overwriteIfFound = true, strategy?: AssetNamingStrategy): Promise<{ asset: Asset, location: string }> {
    const asset = await AssetUtil.blobToAsset(blob, meta);
    const location = await this.upsert(asset, overwriteIfFound, strategy);
    return { asset, location };
  }

  /**
   * Stores an asset with the optional ability to overwrite if the file is already found. If not
   * overwriting and file exists, an error will be thrown.
   *
   * @param asset The asset to store
   * @param overwriteIfFound Overwrite the asset if found
   * @param strategy The naming strategy to use, defaults to the service's strategy if not provided
   */
  async upsert({ source, ...asset }: Asset, overwriteIfFound = true, strategy?: AssetNamingStrategy): Promise<string> {
    // Apply strategy on save
    const location = (strategy ?? this.#namingStrategy!).resolve(asset);

    if (!overwriteIfFound) {
      let missing = false;
      try {
        await this.describe(location);
      } catch (err) {
        if (err instanceof NotFoundError) {
          missing = true;
        } else {
          throw err;
        }
      }
      if (!missing) {
        throw new ExistsError('Asset', location);
      }
    }

    let stream: Readable;
    if (typeof source === 'string') {
      stream = Readable.from(source, { encoding: source.endsWith('=') ? 'base64' : 'utf8' });
    } else if (Buffer.isBuffer(source)) {
      stream = Readable.from(source);
    } else {
      stream = source;
    }

    await this.#store.upsertStream(location, stream, asset);
    return location;
  }

  /**
   * Retrieve a file from the store, with the ability to ensure certain tags
   * are set on the asset.  This can be used as a rudimentary ACL to ensure
   * cross account assets aren't shared.
   *
   * @param location The location to find.
   */
  async get(location: string, range?: StreamRange): Promise<StreamResponse> {
    const meta = await this.describe(location);
    const fullRange = range ? enforceRange(range, meta.size) : undefined;
    const stream = new PassThrough();
    const load = (): void => { this.#store.getStream(location, range).then(v => v.pipe(stream)); };
    return new StreamResponse(() => (load(), stream), meta, fullRange);
  }
}