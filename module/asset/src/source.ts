import { Asset } from './types';

/**
 * A source for an asset
 */
export abstract class AssetSource {
  /**
   * Write stream to asset store
   */
  abstract write(asset: Asset, stream: NodeJS.ReadableStream): Promise<void>;
  /**
   * Get stream from asset store
   */
  abstract read(path: string): Promise<NodeJS.ReadableStream>;
  /**
   * Get info for asset
   */
  abstract info(path: string): Promise<Omit<Asset, 'stream'>>;
  /**
   * Remove from asset store
   */
  abstract delete(path: string): Promise<void>;
}