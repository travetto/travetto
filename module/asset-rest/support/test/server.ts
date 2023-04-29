import assert from 'assert';

import { AssetUtil, Asset, AssetService, AssetModelⲐ } from '@travetto/asset';
import { ObjectUtil, StreamUtil } from '@travetto/base';
import { Controller, Get, Post, Request, Response } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest/support/test/base';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { Inject, InjectableFactory } from '@travetto/di';
import { MemoryModelService, ModelStreamSupport } from '@travetto/model';

import { Upload, UploadAll } from '../../src/decorator';
import { AssetRestUtil } from '../../src/util';

type FileUpload = { name: string, resource: string, type: string };

class Config {
  @InjectableFactory(AssetModelⲐ)
  static getStore(): ModelStreamSupport {
    return new MemoryModelService({});
  }
}

@Controller('/test/upload')
class TestUploadController {

  @Inject()
  service: AssetService;

  @Post('/all')
  @UploadAll()
  async uploadAll({ files }: Request) {
    for (const [, file] of Object.entries(files)) {
      const { source: _, ...meta } = file;
      return meta;
    }
  }

  @Post('/')
  async upload(@Upload() file: Asset) {
    const { source: _, ...meta } = file;
    const loc = await this.service.upsert(file);
    return { ...meta, location: loc };
  }

  @Post('/all-named')
  async uploads(@Upload('file1') file1: Asset, @Upload('file2') file2: Asset) {
    return { hash1: file1.hash, hash2: file2.hash };
  }

  @Post('/all-named-custom')
  async uploadVariousLimits(@Upload({ name: 'file1', types: ['!image/png'] }) file1: Asset, @Upload('file2') file2: Asset) {
    return { hash1: file1.hash, hash2: file2.hash };
  }

  @Post('/all-named-size')
  async uploadVariousSizeLimits(@Upload({ name: 'file1', maxSize: 100 }) file1: Asset, @Upload({ name: 'file2', maxSize: 8000 }) file2: Asset) {
    return { hash1: file1.hash, hash2: file2.hash };
  }

  @Get('*')
  async get(req: Request, res: Response) {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    if (req.headers.range) {
      res.setHeader('Accept-Ranges', 'bytes');
      const range = req.headers.range;
      [start, end] = range.replace(/bytes=/, '').split('-')
        .map(x => x ? parseInt(x, 10) : undefined);
    }

    const response = await this.service.get(req.url.replace(/^\/test\/upload\//, ''), start, end);
    return AssetRestUtil.downloadable(response);
  }
}

@Suite()
export abstract class AssetRestServerSuite extends BaseRestSuite {

  fixture: TestFixtures;

  async getUploads(...files: FileUpload[]) {
    return Promise.all(files.map(async ({ name, type, resource: filename }) => {
      const buffer = await StreamUtil.streamToBuffer(await this.fixture.readStream(filename));
      return { name, type, filename, buffer, size: buffer.length };
    }));
  }

  async getAsset(pth: string) {
    return AssetUtil.fileToAsset(await (await this.fixture.describe(pth)).path);
  }

  @BeforeAll()
  async init() {
    this.fixture = new TestFixtures(['@travetto/asset']);
    await RootRegistry.init();
  }

  @Test()
  async testUploadAll() {
    const [sent] = await this.getUploads({ name: 'random', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<Asset>('post', '/test/upload/all', this.getMultipartRequest([sent]));

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

  @Test()
  async testMultiUploadCustom() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const resBad = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named-custom', {
      ...this.getMultipartRequest(uploadBad),
      throwOnError: false
    });
    assert(resBad.status === 400);


    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.gif', type: 'image/gif' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named-custom', {
      ...this.getMultipartRequest(uploads),
      throwOnError: false
    });
    assert(res.status === 200);

    const asset = await this.getAsset('/logo.gif');
    assert(res.body.hash1 === asset.hash);

    const asset2 = await this.getAsset('/logo.png');
    assert(res.body.hash2 === asset2.hash);
  }

  @Test()
  async testMultiUploadSize() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const resBad = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named-size', {
      ...this.getMultipartRequest(uploadBad),
      throwOnError: false
    });
    assert(resBad.status === 400);


    const uploads = await this.getUploads(
      { name: 'file1', resource: 'asset.yml', type: 'text/plain' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named-size', {
      ...this.getMultipartRequest(uploads),
      throwOnError: false
    });
    assert(res.status === 200);

    const asset = await this.getAsset('/asset.yml');
    assert(res.body.hash1 === asset.hash);

    const asset2 = await this.getAsset('/logo.png');
    assert(res.body.hash2 === asset2.hash);
  }

  @Test()
  async testRangedDownload() {
    const [sent] = await this.getUploads({ name: 'file', resource: 'alpha.txt', type: 'text/plain' });
    const res = await this.request<Asset & { location: string }>('post', '/test/upload', {
      headers: {
        'Content-Type': sent.type,
        'Content-Length': `${sent.size}`,
      },
      body: sent.buffer,
      throwOnError: false
    });

    assert(res.status === 200);

    const loc = res.body.location;

    const item = await this.request('get', `/test/upload/${loc}`);
    assert(typeof item.body === 'string');
    assert(item.body.length === 26);

    const itemRanged = await this.request('get', `/test/upload/${loc}`, {
      headers: {
        Range: 'bytes=0-9'
      }
    });

    assert(typeof itemRanged.body === 'string');
    assert(itemRanged.body.length === 10);
    assert(itemRanged.body === 'abcdefghij');

    const itemRanged2 = await this.request('get', `/test/upload/${loc}`, {
      headers: {
        Range: 'bytes=23-25'
      }
    });

    assert(typeof itemRanged2.body === 'string');
    assert(itemRanged2.body.length === 3);
    assert(itemRanged2.body === 'xyz');

    const itemRanged3 = await this.request('get', `/test/upload/${loc}`, {
      headers: {
        Range: 'bytes=20-30'
      },
      throwOnError: false
    });

    assert(itemRanged3.status === 400);
    assert(ObjectUtil.isPlainObject(itemRanged3.body));
    assert('message' in itemRanged3.body);
    assert(typeof itemRanged3.body.message === 'string');
    assert(itemRanged3.body.message.includes('out of range'));
  }
}