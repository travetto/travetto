import * as fs from 'fs';
import * as assert from 'assert';
import FormData from 'formdata-node';

import { FsUtil, StreamUtil } from '@travetto/boot';
import { AssetUtil, Asset } from '@travetto/asset';
import { ResourceManager } from '@travetto/base';
import { Controller, Post } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest//base';
import { AfterAll, BeforeAll, Suite, Test } from '@travetto/test';

import { Upload } from '../../src/decorator';

@Controller('/test/upload')
class TestUploadController {

  @Post('/')
  async upload(@Upload() file: Asset) {
    delete file.stream;
    return file;
  }

  @Post('/all')
  async uploads(@Upload('file1') file1: Asset, @Upload('file2') file2: Asset) {
    return { hash1: file1.hash, hash2: file2.hash };
  }
}

async function getAsset(file: string, type: string) {
  return {
    filename: file,
    stream: await ResourceManager.readStream(file),
    size: (await fs.promises.stat(await ResourceManager.findAbsolute(file))).size,
    type
  };
}

async function getForm(files: Record<string, string>, content: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries(files)) {
    const { stream, ...asset } = await getAsset(v, content);
    form.append(k, stream, asset);
  }
  return form;
}

@Suite({ skip: true })
export abstract class AssetRestServerSuite extends BaseRestSuite {

  @BeforeAll()
  async before() { return this.initServer(); }

  @AfterAll()
  async after() { return this.destroySever(); }


  @BeforeAll()
  async setup() {
    const src = await import('@travetto/asset//service');
    ResourceManager.addPath(FsUtil.resolveUnix(src.AssetServiceSuite.ᚕfile, '..', '..'));
  }

  @Test()
  async testUploadDirect() {
    const sent = await getAsset('logo.png', 'image/png');
    const res = await this.makeRequst('post', '/test/upload', {
      headers: {
        'Content-Type': sent.type,
        'Content-Length': `${sent.size}`
      },
      body: await StreamUtil.streamToBuffer(sent.stream)
    });

    const asset = await AssetUtil.fileToAsset(await ResourceManager.findAbsolute('/logo.png'));
    assert(res.body.hash === asset.hash);
  }

  @Test()
  async testUpload() {
    const body = await getForm({ file: 'logo.png' }, 'image/png');
    const res = await this.makeRequst('post', '/test/upload', { headers: body.headers, body });
    const asset = await AssetUtil.fileToAsset(await ResourceManager.findAbsolute('/logo.png'));
    assert(res.body.hash === asset.hash);
  }

  @Test()
  async testMultiUpload() {
    const body = await getForm({ file1: 'logo.png', file2: 'logo.png' }, 'image/png');
    const res = await this.makeRequst('post', '/test/upload/all', { headers: body.headers, body });
    const asset = await AssetUtil.fileToAsset(await ResourceManager.findAbsolute('/logo.png'));
    assert(res.body.hash1 === asset.hash);
    assert(res.body.hash2 === asset.hash);
  }
}