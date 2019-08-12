import { Asset } from './types';

export abstract class AssetSource {
  abstract write(asset: Asset, stream: NodeJS.ReadableStream): Promise<void>;
  abstract read(path: string): Promise<NodeJS.ReadableStream>;
  abstract info(path: string): Promise<Asset>;
  abstract remove(path: string): Promise<void>;
}