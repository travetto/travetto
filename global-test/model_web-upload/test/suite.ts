import assert from 'node:assert';

import { Controller, Get, Post, type WebRequest, ContextParam, WebHeaderUtil } from '@travetto/web';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Inject } from '@travetto/di';
import type { MemoryModelService } from '@travetto/model-memory';
import { Upload, type FileMap } from '@travetto/web-upload';
import { Util, type BinaryMetadata, castTo, type RuntimeError, BinaryMetadataUtil } from '@travetto/runtime';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';

const getHash = (blob: Blob) => BinaryMetadataUtil.read(blob)?.hash;

@Controller('/test/upload')
class TestUploadController {

  @Inject()
  service: MemoryModelService;

  @ContextParam()
  request: WebRequest;

  @Post('/all')
  async uploadAll(@Upload() uploads: FileMap) {
    for (const [, file] of Object.entries(uploads)) {
      return { hash: getHash(file), size: file.size };
    }
  }

  @Post('/')
  async upload(@Upload() file: Blob) {
    await this.service.upsertBlob('orange', file);
    const desc = await this.service.getBlobMetadata('orange');
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
  async uploads(@Upload() file1: Blob, @Upload() file2: Blob) {
    return { hash1: getHash(file1), hash2: getHash(file2) };
  }

  @Post('/all-named-custom')
  async uploadVariousLimits(@Upload({ types: ['!image/png'] }) file1: Blob, @Upload() file2: Blob) {
    return { hash1: getHash(file1), hash2: getHash(file2) };
  }

  @Post('/all-named-size')
  async uploadVariousSizeLimits(@Upload({ maxSize: 100 }) file1: File, @Upload({ maxSize: 8000 }) file2: File) {
    return { hash1: getHash(file1), hash2: getHash(file2) };
  }

  @Get('*')
  async get() {
    const range = WebHeaderUtil.getRange(this.request.headers);
    return this.service.getBlob(this.request.context.path.replace(/^\/test\/upload\//, ''), range);
  }
}

@Suite()
export abstract class ModelBlobWebUploadServerSuite extends BaseWebSuite {

  fixture: TestFixtures;

  async getUploads(...files: { name: string, resource: string, type?: string }[]): Promise<FormData> {
    const data = new FormData();
    await Promise.all(files.map(async ({ name, type, resource }) => {
      data.append(name, BinaryMetadataUtil.defineBlob(
        new File([], ''),
        () => this.fixture.readBinaryStream(resource),
        { contentType: type, filename: resource }
      ));
    }));
    return data;
  }

  async getFileMeta(location: string) {
    const loc = await this.fixture.readBinaryStream(location);
    return { hash: await BinaryMetadataUtil.hash(loc, { hashAlgorithm: 'sha256' }) };
  }

  @BeforeAll()
  async init() {
    this.fixture = new TestFixtures(['@travetto/model', '@travetto/web-upload']);
    await Registry.init();
  }

  @Test()
  async testUploadAll() {
    const uploads = await this.getUploads({ name: 'random', resource: 'logo.png', type: 'image/png' });
    const response = await this.request<BinaryMetadata>({ body: uploads, context: { httpMethod: 'POST', path: '/test/upload/all' } });

    const { hash } = await this.getFileMeta('/logo.png');
    assert(response.body?.hash === hash);
  }

  @Test()
  async testUploadDirect() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const sent = castTo<Blob>(uploads.get('file'));
    const response = await this.request<{ location: string, meta: BinaryMetadata }>({ context: { httpMethod: 'POST', path: '/test/upload' }, body: sent });

    const { hash } = await this.getFileMeta('/logo.png');
    assert(response.body?.meta.hash === hash);
  }

  @Test()
  async testUpload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const response = await this.request<{ location: string, meta: BinaryMetadata }>(
      { body: uploads, context: { httpMethod: 'POST', path: '/test/upload' } }
    );
    const { hash } = await this.getFileMeta('/logo.png');
    assert(response.body?.meta.hash === hash);
  }

  @Test()
  async testCached() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const response = await this.request(
      { body: uploads, context: { httpMethod: 'POST', path: '/test/upload/cached' } }
    );
    assert(response.context.httpStatusCode === 200);
    assert(response.headers.get('Cache-Control') === 'max-age=3600');
    assert(response.headers.get('Content-Language') === 'en-GB');
  }

  @Test()
  async testMultiUpload() {
    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const response = await this.request<{ hash1: string, hash2: string }>(
      { body: uploads, context: { httpMethod: 'POST', path: '/test/upload/all-named' } }
    );
    const { hash } = await this.getFileMeta('/logo.png');
    assert(response.body?.hash1 === hash);
    assert(response.body?.hash2 === hash);
  }

  @Test()
  async testMultiUploadCustom() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const badResponse = await this.request<{ hash1: string, hash2: string }>(
      {
        body: uploadBad,
        context: {
          httpMethod: 'POST',
          path: '/test/upload/all-named-custom',
        }
      },
      false
    );
    assert(badResponse.context.httpStatusCode === 400);

    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.gif', type: 'image/gif' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const response = await this.request<{ hash1: string, hash2: string }>(
      {
        body: uploads,
        context: {
          httpMethod: 'POST', path: '/test/upload/all-named-custom',
        }
      },
      false
    );
    assert(response.context.httpStatusCode === 200);

    const blob = await this.getFileMeta('/logo.gif');
    assert(response.body?.hash1 === blob?.hash);

    const blob2 = await this.getFileMeta('/logo.png');
    assert(response.body?.hash2 === blob2?.hash);
  }

  @Test()
  async testMultiUploadSize() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const badResponse = await this.request<{ hash1: string, hash2: string }>(
      {
        body: uploadBad,
        context: {
          httpMethod: 'POST',
          path: '/test/upload/all-named-size',
        }
      },
      false
    );
    assert(badResponse.context.httpStatusCode === 400);

    const uploads = await this.getUploads(
      { name: 'file1', resource: 'asset.yml', type: 'text/plain' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const response = await this.request<{ hash1: string, hash2: string }>(
      {
        body: uploads,
        context: {
          httpMethod: 'POST',
          path: '/test/upload/all-named-size',
        }
      },
      false
    );
    assert(response.context.httpStatusCode === 200);

    const blob = await this.getFileMeta('/asset.yml');
    assert(response.body?.hash1 === blob?.hash);

    const blob2 = await this.getFileMeta('/logo.png');
    assert(response.body?.hash2 === blob2?.hash);
  }

  @Test()
  async testRangedDownload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'alpha.txt', type: 'text/plain' });
    const sent = castTo<Blob>(uploads.get('file')!);
    const response = await this.request<{ location: string }>({ context: { httpMethod: 'POST', path: '/test/upload' }, body: sent }, false);

    assert(response.context.httpStatusCode === 200);

    const loc = response.body?.location;

    const item = await this.request({ context: { httpMethod: 'GET', path: `/test/upload/${loc}` } });
    console.log(item);
    assert(typeof item.body === 'string');
    assert(item.body?.length === 26);

    const itemRanged = await this.request(
      {
        context: {
          httpMethod: 'GET', path: `/test/upload/${loc}`,
        },
        headers: {
          Range: 'bytes=0-9'
        }
      }
    );

    assert(typeof itemRanged.body === 'string');
    assert(itemRanged.body === 'abcdefghij');
    assert(itemRanged.body?.length === 10);

    const itemRanged2 = await this.request(
      {
        context: {
          httpMethod: 'GET',
          path: `/test/upload/${loc}`,
        },
        headers: {
          Range: 'bytes=23-25'
        }
      }
    );

    assert(typeof itemRanged2.body === 'string');
    assert(itemRanged2.body?.length === 3);
    assert(itemRanged2.body === 'xyz');

    const itemRanged3 = await this.request<RuntimeError>(
      {
        context: {
          httpMethod: 'GET',
          path: `/test/upload/${loc}`,
        },
        headers: {
          Range: 'bytes=30-20'
        },
      },
      false
    );

    assert(itemRanged3.context.httpStatusCode === 400);
    assert(typeof itemRanged3.body?.message === 'string');
    assert(itemRanged3.body?.message.includes('out of range'));
  }
}