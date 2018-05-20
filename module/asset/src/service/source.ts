import { Asset, AssetMetadata } from '../model';

export abstract class AssetSource {
  abstract write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset>;
  abstract update(file: Asset): Promise<Asset>;
  abstract read(filename: string): Promise<NodeJS.ReadableStream>;
  abstract info(filename: string, filter?: AssetMetadata): Promise<Asset>;
  abstract find(filter: AssetMetadata): Promise<Asset[]>;
  abstract remove(filename: string): Promise<void>;
}