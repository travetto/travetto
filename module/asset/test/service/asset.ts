import { AssetService, ImageService, AssetUtil, AssetSource, Asset } from '../../src';
import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry, Injectable } from '@travetto/di';
import * as fs from 'fs';
import * as assert from 'assert';
import * as util from 'util';

@Injectable({ target: AssetSource })
class MockAssetSource extends AssetSource {
  streams = new Map<string, string>();
  files = new Map<string, Asset>();

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset> {
    this.streams.set(file.filename, (stream as any).path);
    this.files.set(file.filename, file);
    return this.info(file.filename);
  }

  update(file: Asset): Promise<Asset> {
    throw new Error('Method not implemented.');
  }

  async read(filename: string): Promise<NodeJS.ReadableStream> {
    return fs.createReadStream(this.streams.get(filename)!);
  }

  async info(filename: string, filter?: any): Promise<Asset> {
    if (!this.files.has(filename)) {
      throw new Error('Not found');
    }
    return new Asset(this.files.get(filename)!);
  }

  find(filter: Asset): Promise<Asset[]> {
    throw new Error('Method not implemented.');
  }

  remove(filename: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}


@Suite('Asset Service')
class AssetTest {
  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @Test('downloads an file from a url')
  async download() {
    const service = await DependencyRegistry.getInstance(AssetService);

    const filePath = await AssetUtil.downloadUrl('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png');
    assert(filePath !== undefined);
    assert(filePath.split('.').pop() === 'png');

    let file = await AssetUtil.localFileToAsset(filePath);
    file = await service.save(file);

    assert(file.contentType === 'image/png');
    assert(file.length > 0);

    try {
      util.promisify(fs.stat)(filePath);
    } catch (err) {
      assert(err instanceof Error);
    }
  }

  @Test('Test caching')
  async cache() {
    const service = await DependencyRegistry.getInstance(AssetService);
    const imageService = await DependencyRegistry.getInstance(ImageService);

    const filePath = await AssetUtil.downloadUrl('https://image.freepik.com/free-icon/apple-logo_318-40184.jpg');
    assert(filePath !== undefined);
    assert(filePath.split('.').pop() === 'jpeg');
    let file = await AssetUtil.localFileToAsset(filePath);
    file = await service.save(file, false, false);

    const asset = await service.get(file.filename);
    assert.ok(asset);

    let start = Date.now();
    let resized = await imageService.getImage(file.filename, { w: 10, h: 10 });
    const diff = Date.now() - start;

    start = Date.now();
    resized = await imageService.getImage(file.filename, { w: 10, h: 10 });
    const diff2 = Date.now() - start;

    assert(diff2 < diff);
  }
}