import assert from 'node:assert';

import { BinaryUtil, castTo } from '@travetto/runtime';
import { Controller, Post } from '@travetto/web';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { Registry } from '@travetto/registry';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';

import { Upload } from '../../src/decorator.ts';
import type { FileMap } from '../../src/types.ts';

const getHash = (blob: Blob) => BinaryUtil.getMetadata(blob)?.hash;

@Controller('/test/upload')
class TestUploadController {

  @Post('/all')
  async uploadAll(@Upload() uploads: FileMap): Promise<{ hash?: string } | undefined> {
    for (const [, blob] of Object.entries(uploads)) {
      return { hash: getHash(blob) };
    }
  }

  @Post('/')
  async upload(@Upload() file: File) {
    return { hash: getHash(file) };
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
}

@Suite()
export abstract class WebUploadServerSuite extends BaseWebSuite {

  fixture: TestFixtures;

  async getUploads(...files: { name: string, resource: string, type?: string }[]): Promise<FormData> {
    const data = new FormData();
    await Promise.all(files.map(async ({ name, type, resource }) => {
      const file = await this.fixture.readFile(resource);
      if (type) {
        Object.defineProperty(file, 'type', { get: () => type });
      }
      data.append(name, file);
    }));
    return data;
  }

  @BeforeAll()
  async init() {
    this.fixture = new TestFixtures(['@travetto/asset']);
    await Registry.init();
  }

  @Test()
  async testUploadAll() {
    const uploads = await this.getUploads({ name: 'random', resource: 'logo.png', type: 'image/png' });
    const response = await this.request<{ hash: string }>({ body: uploads, context: { httpMethod: 'POST', path: '/test/upload/all' } });

    const file = await this.fixture.readStream('/logo.png');
    assert(response.body?.hash === await BinaryUtil.hash(file, { hashAlgorithm: 'sha256' }));
  }

  @Test()
  async testUploadDirect() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const sent = castTo<Blob>(uploads.get('file'));
    const response = await this.request<{ hash: string }>({ context: { httpMethod: 'POST', path: '/test/upload' }, body: sent });

    const file = await this.fixture.readStream('/logo.png');
    assert(response.body?.hash === await BinaryUtil.hash(file, { hashAlgorithm: 'sha256' }));
  }

  @Test()
  async testUpload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const response = await this.request<{ hash: string }>({ body: uploads, context: { httpMethod: 'POST', path: '/test/upload' } });

    const file = await this.fixture.readStream('/logo.png');
    assert(response.body?.hash === await BinaryUtil.hash(file, { hashAlgorithm: 'sha256' }));
  }

  @Test()
  async testMultiUpload() {
    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const response = await this.request<{ hash1: string, hash2: string }>({
      body: uploads,
      context: {
        httpMethod: 'POST', path: '/test/upload/all-named'
      }
    });
    const file = await this.fixture.readStream('/logo.png');
    const hash = await BinaryUtil.hash(file, { hashAlgorithm: 'sha256' });

    assert(response.body?.hash1 === hash);
    assert(response.body?.hash2 === hash);
  }

  @Test()
  async testMultiUploadCustom() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const badResponse = await this.request<{ hash1: string, hash2: string }>({
      body: uploadBad,
      context: { httpMethod: 'POST', path: '/test/upload/all-named-custom' },
    }, false);
    assert(badResponse.context.httpStatusCode === 400);

    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.gif', type: 'image/gif' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const response = await this.request<{ hash1: string, hash2: string }>({
      body: uploads,
      context: { httpMethod: 'POST', path: '/test/upload/all-named-custom' },
    }, false);
    assert(response.context.httpStatusCode === 200);

    const file1 = await this.fixture.readStream('/logo.gif');
    const hash1 = await BinaryUtil.hash(file1, { hashAlgorithm: 'sha256' });

    const file2 = await this.fixture.readStream('/logo.png');
    const hash2 = await BinaryUtil.hash(file2, { hashAlgorithm: 'sha256' });

    assert(response.body?.hash1 === hash1);
    assert(response.body?.hash2 === hash2);
  }

  @Test()
  async testMultiUploadSize() {
    const uploadBad = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );

    const badResponse = await this.request<{ hash1: string, hash2: string }>({
      body: uploadBad,
      context: { httpMethod: 'POST', path: '/test/upload/all-named-size' },
    }, false);
    assert(badResponse.context.httpStatusCode === 400);

    const uploads = await this.getUploads(
      { name: 'file1', resource: 'asset.yml', type: 'text/plain' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const response = await this.request<{ hash1: string, hash2: string }>({
      body: uploads,
      context: { httpMethod: 'POST', path: '/test/upload/all-named-size' },
    }, false);
    assert(response.context.httpStatusCode === 200);

    const file1 = await this.fixture.readStream('/asset.yml');
    const hash1 = await BinaryUtil.hash(file1, { hashAlgorithm: 'sha256' });

    const file2 = await this.fixture.readStream('/logo.png');
    const hash2 = await BinaryUtil.hash(file2, { hashAlgorithm: 'sha256' });

    assert(response.body?.hash1 === hash1);
    assert(response.body?.hash2 === hash2);
  }
}