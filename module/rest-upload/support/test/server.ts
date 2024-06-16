import assert from 'node:assert';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { buffer as toBuffer } from 'node:stream/consumers';

import { Controller, Post, Request } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest/support/test/base';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Upload, UploadAll } from '../../src/decorator';
import { LocalFile } from '../../src/file';

type FileUpload = { name: string, resource: string, type: string };

@Controller('/test/upload')
class TestUploadController {

  /**
   * Compute hash from a file location on disk
   */
  static async hashFile(file: Blob): Promise<string> {
    const hasher = crypto.createHash('sha256').setEncoding('hex');
    await pipeline(file.stream(), hasher);
    return hasher.read().toString();
  }


  @Post('/all')
  @UploadAll()
  async uploadAll({ files }: Request): Promise<{ hash: string } | undefined> {
    for (const [, file] of Object.entries(files)) {
      return { hash: await TestUploadController.hashFile(file) };
    }
  }

  @Post('/')
  async upload(@Upload() file: File) {
    return { hash: await TestUploadController.hashFile(file) };
  }

  @Post('/all-named')
  async uploads(@Upload('file1') file1: Blob, @Upload('file2') file2: Blob) {
    return { hash1: await TestUploadController.hashFile(file1), hash2: await TestUploadController.hashFile(file2) };
  }

  @Post('/all-named-custom')
  async uploadVariousLimits(@Upload({ name: 'file1', types: ['!image/png'] }) file1: Blob, @Upload('file2') file2: Blob) {
    return { hash1: await TestUploadController.hashFile(file1), hash2: await TestUploadController.hashFile(file2) };
  }

  @Post('/all-named-size')
  async uploadVariousSizeLimits(@Upload({ name: 'file1', maxSize: 100 }) file1: File, @Upload({ name: 'file2', maxSize: 8000 }) file2: File) {
    return { hash1: await TestUploadController.hashFile(file1), hash2: await TestUploadController.hashFile(file2) };
  }
}

@Suite()
export abstract class RestUploadServerSuite extends BaseRestSuite {

  fixture: TestFixtures;

  async getUploads(...files: FileUpload[]) {
    return Promise.all(files.map(async ({ name, type, resource: filename }) => {
      const buffer = await toBuffer(await this.fixture.readStream(filename));
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

    const file = new LocalFile(await this.fixture.resolve('/logo.png'));
    assert(res.body.hash === await TestUploadController.hashFile(file));
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

    const file = new LocalFile(await this.fixture.resolve('/logo.png'));
    assert(res.body.hash === await TestUploadController.hashFile(file));
  }

  @Test()
  async testUpload() {
    const uploads = await this.getUploads({ name: 'file', resource: 'logo.png', type: 'image/png' });
    const res = await this.request<{ hash: string }>('post', '/test/upload', this.getMultipartRequest(uploads));

    const file = new LocalFile(await this.fixture.resolve('/logo.png'));
    assert(res.body.hash === await TestUploadController.hashFile(file));
  }

  @Test()
  async testMultiUpload() {
    const uploads = await this.getUploads(
      { name: 'file1', resource: 'logo.png', type: 'image/png' },
      { name: 'file2', resource: 'logo.png', type: 'image/png' }
    );
    const res = await this.request<{ hash1: string, hash2: string }>('post', '/test/upload/all-named', this.getMultipartRequest(uploads));
    const file = new LocalFile(await this.fixture.resolve('/logo.png'));
    const hash = await TestUploadController.hashFile(file);

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

    const file1 = new LocalFile(await this.fixture.resolve('/logo.gif'));
    const hash1 = await TestUploadController.hashFile(file1);

    const file2 = new LocalFile(await this.fixture.resolve('/logo.png'));
    const hash2 = await TestUploadController.hashFile(file2);

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

    const file1 = new LocalFile(await this.fixture.resolve('/asset.yml'));
    const hash1 = await TestUploadController.hashFile(file1);

    const file2 = new LocalFile(await this.fixture.resolve('/logo.png'));
    const hash2 = await TestUploadController.hashFile(file2);

    assert(res.body.hash1 === hash1);
    assert(res.body.hash2 === hash2);
  }
}