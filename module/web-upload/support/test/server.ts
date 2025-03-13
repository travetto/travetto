import assert from 'node:assert';

import { BinaryUtil } from '@travetto/runtime';
import { Controller, Post } from '@travetto/web';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { BaseWebSuite } from '@travetto/web/support/test/base.ts';

import { Upload } from '../../src/decorator.ts';
import { FileMap } from '../../src/types.ts';

type FileUpload = { name: string, resource: string, type: string };

const bHash = (blob: Blob) => BinaryUtil.getBlobMeta(blob)?.hash;

@Controller('/test/upload')
class TestUploadController {

  @Post('/all')
  async uploadAll(@Upload() uploads: FileMap): Promise<{ hash?: string } | undefined> {
    for (const [, blob] of Object.entries(uploads)) {
      return { hash: bHash(blob) };
    }
  }

  @Post('/')
  async upload(@Upload() file: File) {
    return { hash: bHash(file) };
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
}

@Suite()
export abstract class WebUploadServerSuite extends BaseWebSuite {

  fixture: TestFixtures;

  async getUploads(...files: FileUpload[]) {
    return Promise.all(files.map(async ({ name, type, resource: filename }) => {
      const buffer = await this.fixture.read(filename, true);
      return { name, type, filename, buffer, size: buffer.length };
    }));
  }

  @BeforeAll()
  async init() {
    this.fixture = new TestFixtures(['@travetto/asset']);
    await RootRegistry.init();
  }

  @Test()
  async testUploadAll() {
    const [sent] = await this.getUploads({ name: 'random', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<{ hash: string }>('post', '/test/upload/all', this.getMultipartRequest([sent]));

    const file = await this.fixture.readStream('/logo.png');
    assert(res.body.hash === await BinaryUtil.hashInput(file));
  }

  @Test()
  async testUploadDirect() {
    const [sent] = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<{ hash: string }>('post', '/test/upload', {
      headers: {
        'Content-Type': sent.type,
        'Content-Length': `${sent.size}`
      },
      body: sent.buffer
    });

    const file = await this.fixture.readStream('/logo.png');
    assert(res.body.hash === await BinaryUtil.hashInput(file));
  }

  @Test()
  async testUpload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<{ hash: string }>('post', '/test/upload', this.getMultipartRequest(uploads));

    const file = await this.fixture.readStream('/logo.png');
    assert(res.body.hash === await BinaryUtil.hashInput(file));
  }

  @Test()
  async testMultiUpload() {
    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named', this.getMultipartRequest(uploads));
    const file = await this.fixture.readStream('/logo.png');
    const hash = await BinaryUtil.hashInput(file);

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

    const file1 = await this.fixture.readStream('/logo.gif');
    const hash1 = await BinaryUtil.hashInput(file1);

    const file2 = await this.fixture.readStream('/logo.png');
    const hash2 = await BinaryUtil.hashInput(file2);

    assert(res.body.hash1 === hash1);
    assert(res.body.hash2 === hash2);
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

    const file1 = await this.fixture.readStream('/asset.yml');
    const hash1 = await BinaryUtil.hashInput(file1);

    const file2 = await this.fixture.readStream('/logo.png');
    const hash2 = await BinaryUtil.hashInput(file2);

    assert(res.body.hash1 === hash1);
    assert(res.body.hash2 === hash2);
  }
}