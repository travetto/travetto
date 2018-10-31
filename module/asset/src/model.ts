import { FsUtil } from '@travetto/base';

export interface AssetFile {
  name: string;
  type?: string;
  size: number;
  path: string;
  hash: string;
}

export interface AssetMetadata {
  name: string;
  title: string;
  hash: string;
  createdDate: Date;
  tags?: string[];
}

export class Asset {

  static fields = ['filename', 'length', 'contentType', 'path', 'metadata', 'stream'];

  stream?: NodeJS.ReadableStream;
  length: number;
  filename: string;
  contentType: string;
  path: string;
  metadata: AssetMetadata;

  constructor(conf?: Partial<Asset>) {
    if (conf) {
      for (const k of Asset.fields) {
        if ((conf as any)[k]) {
          if (k === 'metadata') {
            (this as any)[k] = { ... (conf as any)[k] };
          } else {
            (this as any)[k] = (conf as any)[k];
          }
        }
      }
    }
  }

  async read() {
    const res = (await FsUtil.readFileAsync(this.path)).toString();
    await FsUtil.unlinkAsync(this.path);
    return res;
  }
}