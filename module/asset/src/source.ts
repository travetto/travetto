import { Asset } from './types';

/**
 * A source for an asset
 */
export abstract class AssetSource {
  /**
   * Write stream to asset store
   * @param asset The assert to write
   */
  abstract write(asset: Asset): Promise<void>;
  /**
   * Get stream from asset store
   * @param path The path in the asset store to retreive
   */
  abstract read(path: string): Promise<NodeJS.ReadableStream>;
  /**
   * Get info for asset
   * @param path The path to get the info for
   */
  abstract info(path: string): Promise<Omit<Asset, 'stream'>>;
  /**
   * Remove from asset store
   * @param path The path to delete
   */
  abstract delete(path: string): Promise<void>;
}