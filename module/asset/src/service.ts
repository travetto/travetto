import { Inject, Injectable } from '@travetto/di';
import { ModelStreamSupport, StreamMeta, ExistsError, NotFoundError } from '@travetto/model-core';

import { Asset } from './types';
import { AssetNamingStrategy, SimpleNamingStrategy } from './naming';

export const AssetModelSymbol = Symbol.for('@trv:asset/model');

/**
 * Services asset CRUD operations.  Takes in a source is defined elsewhere.
 * Additionally supports a naming strategy that allows for translation of names
 * to and from the asset source.
 */
@Injectable()
export class AssetService {

  constructor(
    @Inject(AssetModelSymbol)
    private store: ModelStreamSupport,
    private namingStrategy?: AssetNamingStrategy) {
    if (!namingStrategy) {
      this.namingStrategy = new SimpleNamingStrategy();
    }
  }

  /**
   * Delete a given id
   * @param id The id to an asset
   */
  delete(id: string) {
    return this.store.deleteStream(id);
  }

  /**
   * Get the asset info
   * @param id The file to read
   */
  getMetadata(id: string): Promise<StreamMeta> {
    return this.store.getStreamMetadata(id);
  }

  /**
   * Stores an asset with the optional ability to overwrite if the file is already found. If not
   * overwriting and file exists, an error will be thrown.
   *
   * @param asset The asset to store
   * @param overwriteIfFound Overwite the asset if found
   * @param strategy The naming strategy to use, defaults to the service's strategy if not provided
   */
  async upsert({ stream, ...asset }: Asset & { stream: NodeJS.ReadableStream }, overwriteIfFound = true, strategy?: AssetNamingStrategy): Promise<string> {
    // Apply strategy on save
    const id = (strategy ?? this.namingStrategy!).resolve(asset);

    if (!overwriteIfFound) {
      let missing = false;
      try {
        await this.getMetadata(id);
      } catch (err) {
        if (err instanceof NotFoundError) {
          missing = true;
        } else {
          throw err;
        }
      }
      if (!missing) {
        throw new ExistsError('File', id);
      }
    }

    await this.store.upsertStream(id, stream, asset);
    return id;
  }

  /**
   * Retrieve a file from the store, with the ability to ensure certain tags
   * are set on the asset.  This can be used as a rudimentary ACL to ensure
   * cross account assets aren't shared.
   *
   * @param id The id to find.
   */
  async get(id: string): Promise<Asset> {
    const stream = await this.store.getStream(id);
    const info = await this.getMetadata(id);
    return { stream, ...info };
  }
}