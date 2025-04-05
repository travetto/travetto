import assert from 'node:assert';

import { DataUtil } from '@travetto/schema';
import { Controller, Get, Post, WebRequest, ContextParam, WebResponse } from '@travetto/web';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { Inject } from '@travetto/di';
import { MemoryModelService } from '@travetto/model-memory';
import { Upload, FileMap } from '@travetto/web-upload';
import { Util, BlobMeta, BinaryUtil, castTo } from '@travetto/runtime';

import { BaseWebSuite } from '@travetto/web/support/test/base.ts';

const bHash = (blob: Blob) => BinaryUtil.getBlobMeta(blob)?.hash;

const multipart = (data: FormData) => new WebRequest(WebResponse.from(data));

@Controller('/test/upload')
class TestUploadController {

  @Inject()
  service: MemoryModelService;

  @ContextParam()
  req: WebRequest;

  @Post('/all')
  async uploadAll(@Upload() uploads: FileMap) {
    for (const [, file] of Object.entries(uploads)) {
      return { hash: bHash(file) };
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
    return { hash1: bHash(file1), hash2: bHash(file2) };
  }

  @Post('/all-named-custom')
  async uploadVariousLimits(@Upload({ name: 'file1', types: ['!image/png'] }) file1: Blob, @Upload('file2') file2: Blob) {
    return { hash1: bHash(file1), hash2: bHash(file2) };
  }

  @Post('/all-named-size')
  async uploadVariousSizeLimits(@Upload({ name: 'file1', maxSize: 100 }) file1: File, @Upload({ name: 'file2', maxSize: 8000 }) file2: File) {
    return { hash1: bHash(file1), hash2: bHash(file2) };
  }

  @Get('*')
  async get() {
    const range = this.req.headers.getRange();
    return await this.service.getBlob(this.req.path.replace(/^\/test\/upload\//, ''), range);
  }
}

@Suite()
export abstract class ModelBlobWebUploadServerSuite extends BaseWebSuite {

  fixture: TestFixtures;

  async getUploads(...files: { name: string, resource: string, type?: string }[]): Promise<FormData> {
    const data = new FormData();
    await Promise.all(files.map(async ({ name, type, resource }) => {
      const file = await this.fixture.readFile(resource);
      if (type) {
        Object.assign(file, { type });
      }
      data.append(name, file);
    }));
    return data;
  }

  async getFileMeta(pth: string) {
    const loc = await this.fixture.readStream(pth);
    return { hash: await BinaryUtil.hashInput(loc) };
  }

  @BeforeAll()
  async init() {
    this.fixture = new TestFixtures(['@travetto/model', '@travetto/web-upload']);
    await RootRegistry.init();
  }

  @Test()
  async testUploadAll() {
    const uploads = await this.getUploads({ name: 'random', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<BlobMeta>({ ...multipart(uploads), method: 'POST', path: '/test/upload/all', });

    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.source?.hash === hash);
  }

  @Test()
  async testUploadDirect() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const sent = castTo<Blob>(uploads.get('file')?.slice());
    const res = await this.request<{ location: string, meta: BlobMeta }>({
      method: 'POST',
      path: '/test/upload',
      ...WebResponse.from(sent)
    });

    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.source?.meta.hash === hash);
  }

  @Test()
  async testUpload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<{ location: string, meta: BlobMeta }>(
      { ...multipart(uploads), method: 'POST', path: '/test/upload', }
    );
    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.source?.meta.hash === hash);
  }

  @Test()
  async testCached() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request(
      { ...multipart(uploads), method: 'POST', path: '/test/upload/cached', }
    );
    assert(res.statusCode === 200);
    assert(res.headers.get('Cache-Control') === 'max-age=3600');
    assert(res.headers.get('Content-Language') === 'en-GB');
  }

  @Test()
  async testMultiUpload() {
    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>(
      { ...multipart(uploads), method: 'POST', path: '/test/upload/all-named' }
    );
    const { hash } = await this.getFileMeta('/logo.png');
    assert(res.source?.hash1 === hash);
    assert(res.source?.hash2 === hash);
  }

  @Test()
  async testMultiUploadCustom() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const resBad = await this.request<{ hash1: string, hash2: string }>(
      {
        ...multipart(uploadBad),
        method: 'POST',
        path: '/test/upload/all-named-custom',
      },
      false
    );
    assert(resBad.statusCode === 400);

    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.gif', type: 'image/gif' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>(
      {
        ...multipart(uploads),
        method: 'POST', path: '/test/upload/all-named-custom',
      },
      false
    );
    assert(res.statusCode === 200);

    const blob = await this.getFileMeta('/logo.gif');
    assert(res.source?.hash1 === blob?.hash);

    const blob2 = await this.getFileMeta('/logo.png');
    assert(res.source?.hash2 === blob2?.hash);
  }

  @Test()
  async testMultiUploadSize() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const resBad = await this.request<{ hash1: string, hash2: string }>(
      {
        ...multipart(uploadBad),
        method: 'POST',
        path: '/test/upload/all-named-size',
      },
      false
    );
    assert(resBad.statusCode === 400);

    const uploads = await this.getUploads(
      { name: 'file1', resource: 'asset.yml', type: 'text/plain' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>(
      {
        ...multipart(uploads),
        method: 'POST',
        path: '/test/upload/all-named-size',
      },
      false
    );
    assert(res.statusCode === 200);

    const blob = await this.getFileMeta('/asset.yml');
    assert(res.source?.hash1 === blob?.hash);

    const blob2 = await this.getFileMeta('/logo.png');
    assert(res.source?.hash2 === blob2?.hash);
  }

  @Test()
  async testRangedDownload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'alpha.txt', type: 'text/plain' });
    const sent = castTo<Blob>(uploads.get('file')?.slice());
    const res = await this.request<{ location: string }>(
      {
        method: 'POST',
        path: '/test/upload',
        ...WebResponse.from(sent)
      },
      false
    );

    assert(res.statusCode === 200);

    const loc = res.source?.location;

    const item = await this.request({ method: 'GET', path: `/test/upload/${loc}` });
    assert(typeof item.source === 'string');
    assert(item.source?.length === 26);

    const itemRanged = await this.request(
      {
        method: 'GET', path: `/test/upload/${loc}`,
        headers: {
          Range: 'bytes=0-9'
        }
      }
    );

    assert(typeof itemRanged.source === 'string');
    assert(itemRanged.source === 'abcdefghij');
    assert(itemRanged.source?.length === 10);

    const itemRanged2 = await this.request(
      {
        method: 'GET',
        path: `/test/upload/${loc}`,
        headers: {
          Range: 'bytes=23-25'
        }
      }
    );

    assert(typeof itemRanged2.source === 'string');
    assert(itemRanged2.source?.length === 3);
    assert(itemRanged2.source === 'xyz');

    const itemRanged3 = await this.request(
      {
        method: 'GET',
        path: `/test/upload/${loc}`,
        headers: {
          Range: 'bytes=30-20'
        },
      },
      false
    );

    assert(itemRanged3.statusCode === 400);
    assert(DataUtil.isPlainObject(itemRanged3.source));
    assert('message' in itemRanged3.source);
    assert(typeof itemRanged3.source?.message === 'string');
    assert(itemRanged3.source?.message.includes('out of range'));
  }
}