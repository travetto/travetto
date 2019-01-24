import * as fs from 'fs';
import * as util from 'util';

const fsUnlink = util.promisify(fs.unlink);
const fsReadFile = util.promisify(fs.readFile);

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
    const res = (await fsReadFile(this.path)).toString();
    await fsUnlink(this.path);
    return res;
  }
}