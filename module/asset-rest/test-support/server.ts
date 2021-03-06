import * as assert from 'assert';

import { PathUtil, StreamUtil } from '@travetto/boot';
import { AssetUtil, Asset } from '@travetto/asset';
import { ResourceManager } from '@travetto/base';
import { Controller, Post, Request } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest/test-support/base';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { Upload, UploadAll } from '../src/decorator';

type FileUpload = { name: string, resource: string, type: string };

@Controller('/test/upload')
class TestUploadController {

  @Post('/all')
  @UploadAll()
  async uploadAll({ files }: Request) {
    for (const [, file] of Object.entries(files)) {
      const { stream: _, ...meta } = file;
      return meta;
    }
  }

  @Post('/')
  async upload(@Upload() file: Asset) {
    const { stream: _, ...meta } = file;
    return meta;
  }

  @Post('/all-named')
  async uploads(@Upload('file1') file1: Asset, @Upload('file2') file2: Asset) {
    return { hash1: file1.hash, hash2: file2.hash };
  }
}

@Suite()
export abstract class AssetRestServerSuite extends BaseRestSuite {

  async getUploads(...files: FileUpload[]) {
    return Promise.all(files.map(async ({ name, type, resource: filename }) => {
      const buffer = await StreamUtil.streamToBuffer(await ResourceManager.readStream(filename));
      return { name, type, filename, buffer, size: buffer.length };
    }));
  }

  async getAsset(path: string) {
    return AssetUtil.fileToAsset(await ResourceManager.findAbsolute(path));
  }

  @BeforeAll()
  async setup() {
    const src = await import('@travetto/asset/test-support/service');
    ResourceManager.addPath(PathUtil.resolveUnix(src.AssetServiceSuite.ᚕfile, '..', 'resources'));
  }

  @Test()
  async testUploadAll() {
    const [sent] = await this.getUploads({ name: 'random', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<Asset>('post', '/test/upload/all', {
      headers: {
        'Content-Type': sent.type,
        'Content-Length': `${sent.size}`
      },
      body: sent.buffer
    });

    const asset = await this.getAsset('/logo.png');
    assert(res.body.hash === asset.hash);
  }


  @Test()
  async testUploadDirect() {
    const [sent] = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<Asset>('post', '/test/upload', {
      headers: {
        'Content-Type': sent.type,
        'Content-Length': `${sent.size}`
      },
      body: sent.buffer
    });

    const asset = await this.getAsset('/logo.png');
    assert(res.body.hash === asset.hash);
  }

  @Test()
  async testUpload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<Asset>('post', '/test/upload', this.getMultipartRequest(uploads));
    const asset = await this.getAsset('/logo.png');
    assert(res.body.hash === asset.hash);
  }

  @Test()
  async testMultiUpload() {
    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named', this.getMultipartRequest(uploads));
    const asset = await this.getAsset('/logo.png');
    assert(res.body.hash1 === asset.hash);
    assert(res.body.hash2 === asset.hash);
  }
}