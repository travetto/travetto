import assert from 'node:assert';

import { DataUtil } from '@travetto/schema';
import { Controller, Get, Post, Request } from '@travetto/rest';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { Inject } from '@travetto/di';
import { MemoryModelService } from '@travetto/model-memory';
import { Upload, UploadAll } from '@travetto/rest-upload';
import { Util, BlobMeta, BinaryUtil } from '@travetto/runtime';

import { BaseRestSuite } from '@travetto/rest/support/test/base.ts';

type FileUpload = { name: string, resource: string, type: string };

const meta = BinaryUtil.getBlobMeta;

@Controller('/test/upload')
class TestUploadController {

  @Inject()
  service: MemoryModelService;

  @Post('/all')
  @UploadAll()
  async uploadAll({ uploads }: Request) {
    for (const [, file] of Object.entries(uploads)) {
      return meta(file);
    }
  }

  @Post('/')
  async upload(@Upload() file: Blob) {
    await this.service.upsertBlob('orange', file);
    const desc = await this.service.getBlobMeta('orange');
    return { location: 'orange', meta: desc };
  }

  @Post('/cached')
  async uploadCached(@Upload() file: Blob) {
    const location = Util.uuid();
    await this.service.upsertBlob(location, file, {
      cacheControl: 'max-age=3600',
      contentLanguage: 'en-GB'
    });
    return await this.service.getBlob(location);
  }

  @Post('/all-named')
  async uploads(@Upload('file1') file1: Blob, @Upload('file2') file2: Blob) {
    return { hash1: meta(file1)?.hash, hash2: meta(file2)?.hash };
  }

  @Post('/all-named-custom')
  async uploadVariousLimits(@Upload({ name: 'file1', types: ['!image/png'] }) file1: Blob, @Upload('file2') file2: Blob) {
    return { hash1: meta(file1)?.hash, hash2: meta(file2)?.hash };
  }

  @Post('/all-named-size')
  async uploadVariousSizeLimits(@Upload({ name: 'file1', maxSize: 100 }) file1: File, @Upload({ name: 'file2', maxSize: 8000 }) file2: File) {
    return { hash1: meta(file1)?.hash, hash2: meta(file2)?.hash };
  }

  @Get('*')
  async get(req: Request) {
    const range = req.getRange();
    return await this.service.getBlob(req.url.replace(/^\/test\/upload\//, ''), range);
  }
}

@Suite()
export abstract class ModelBlobRestUploadServerSuite extends BaseRestSuite {

  fixture: TestFixtures;

  async getUploads(...files: FileUpload[]) {
    return Promise.all(files.map(async ({ name, type, resource: filename }) => {
      const buffer = await this.fixture.read(filename, true);
      return { name, type, filename, buffer, size: buffer.length };
    }));
  }

  async getFileMeta(pth: string) {
    const loc = await this.fixture.readStream(pth);
    return { hash: await BinaryUtil.hashInput(loc) };
  }

  @BeforeAll()
  async init() {
    this.fixture = new TestFixtures(['@travetto/model', '@travetto/rest-upload']);
    await RootRegistry.init();
  }

  @Test()
  async testUploadAll() {
    const [sent] = await this.getUploads({ name: 'random', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<BlobMeta>('post', '/test/upload/all', this.getMultipartRequest([sent]));

    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.body.hash === hash);
  }

  @Test()
  async testUploadDirect() {
    const [sent] = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<{ location: string, meta: BlobMeta }>('post', '/test/upload', {
      headers: {
        'Content-Type': sent.type,
        'Content-Length': `${sent.size}`
      },
      body: sent.buffer
    });

    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.body.meta.hash === hash);
  }

  @Test()
  async testUpload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<{ location: string, meta: BlobMeta }>('post', '/test/upload', this.getMultipartRequest(uploads));
    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.body.meta.hash === hash);
  }

  @Test()
  async testCached() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request('post', '/test/upload/cached', this.getMultipartRequest(uploads));
    assert(res.status === 200);
    assert(this.getFirstHeader(res.headers, 'cache-control') === 'max-age=3600');
    assert(this.getFirstHeader(res.headers, 'content-language') === 'en-GB');
  }

  @Test()
  async testMultiUpload() {
    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named', this.getMultipartRequest(uploads));
    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.body.hash1 === hash);
    assert(res.body.hash2 === hash);
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

    const blob = await this.getFileMeta('/logo.gif');
    assert(res.body.hash1 === blob?.hash);

    const blob2 = await this.getFileMeta('/logo.png');
    assert(res.body.hash2 === blob2?.hash);
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

    const blob = await this.getFileMeta('/asset.yml');
    assert(res.body.hash1 === blob?.hash);

    const blob2 = await this.getFileMeta('/logo.png');
    assert(res.body.hash2 === blob2?.hash);
  }

  @Test()
  async testRangedDownload() {
    const [sent] = await this.getUploads({ name: 'file', resource: 'alpha.txt', type: 'text/plain' });
    const res = await this.request<{ location: string }>('post', '/test/upload', {
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
    assert(itemRanged.body === 'abcdefghij');
    assert(itemRanged.body.length === 10);

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
        Range: 'bytes=30-20'
      },
      throwOnError: false
    });

    assert(itemRanged3.status === 400);
    assert(DataUtil.isPlainObject(itemRanged3.body));
    assert('message' in itemRanged3.body);
    assert(typeof itemRanged3.body.message === 'string');
    assert(itemRanged3.body.message.includes('out of range'));
  }
}