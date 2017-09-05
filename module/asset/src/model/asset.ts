import { nodeToPromise } from '@encore/base';
import * as fs from 'fs';

export interface AssetFile {
  name: string;
  type?: string;
  size: number;
  path: string;
  hash: string;
}
export class Asset {

  static fields = ['filename', 'length', 'contentType', 'path', 'metadata', 'stream'];

  _id?: string;
  stream?: NodeJS.ReadableStream;
  length: number;
  filename: string;
  contentType: string;
  path: string;
  metadata: {
    name: string,
    title: string,
    hash: string,
    createdDate: Date,
    tags?: string[]
  };

  constructor(conf?: Partial<Asset>) {
    if (conf) {
      for (let k of Asset.fields) {
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
    let res = (await nodeToPromise<Buffer>(fs, fs.readFile, this.path)).toString();
    nodeToPromise(fs, fs.unlink, this.path);
    return res;
  }
}