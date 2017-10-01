import { AssetService, ImageService, AssetUtil, AssetSource, Asset } from '../../src';
import { timeout } from '@travetto/test';
import { expect } from 'chai';
import { DependencyRegistry, Injectable } from '@travetto/di';
import * as fs from 'fs';

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

describe('Asset Service', () => {
  it('downloads an file from a url', async () => {
    let service = await DependencyRegistry.getInstance(AssetService);

    let filePath = await AssetUtil.downloadUrl('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png');
    expect(filePath).to.not.be.undefined;
    expect(filePath.split('.').pop()).equals('png');
    let file = await AssetUtil.localFileToAsset(filePath);
    file = await service.save(file);
    expect(file.contentType).equals('image/png');
    expect(file.length).is.greaterThan(0);

    fs.stat(filePath, (err, stats) => {
      expect(err).to.be.instanceof(Error);
      expect(stats).to.be.undefined;
    });
  });

  it('Test caching', timeout(10000, async () => {
    let service = await DependencyRegistry.getInstance(AssetService);
    let imageService = await DependencyRegistry.getInstance(ImageService);

    let filePath = await AssetUtil.downloadUrl('https://image.freepik.com/free-icon/apple-logo_318-40184.jpg');
    expect(filePath).to.not.be.undefined;
    expect(filePath.split('.').pop()).equals('jpeg');
    let file = await AssetUtil.localFileToAsset(filePath);
    file = await service.save(file, false, false);

    let asset = await service.get(file.filename);
    expect(asset).to.not.be.null;

    let start = Date.now();
    let resized = await imageService.getImage(file.filename, { w: 10, h: 10 });
    let diff = Date.now() - start;

    start = Date.now();
    resized = await imageService.getImage(file.filename, { w: 10, h: 10 });
    let diff2 = Date.now() - start;

    expect(diff2).to.be.lessThan(diff);
  }));
});