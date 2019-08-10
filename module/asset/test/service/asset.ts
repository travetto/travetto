import * as fs from 'fs';
import * as util from 'util';
import * as assert from 'assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry, Injectable } from '@travetto/di';

import { AssetService, AssetUtil, AssetSource, Asset, AssetMetadata } from '../../';
import { ResourceManager } from '@travetto/base';

const fsStat = util.promisify(fs.stat);

@Injectable()
class MockAssetSource extends AssetSource {
  streams = new Map<string, string>();
  files = new Map<string, Asset>();

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset> {
    this.streams.set(file.path, (stream as any).path);
    this.files.set(file.path, file);
    return this.info(file.path);
  }

  update(file: Asset): Promise<Asset> {
    throw new Error('Method not implemented.');
  }

  async read(filename: string): Promise<NodeJS.ReadableStream> {
    return fs.createReadStream(this.streams.get(filename)!);
  }

  async info(filename: string, filter?: Partial<AssetMetadata>): Promise<Asset> {
    if (!this.files.has(filename)) {
      throw new Error('Not found');
    }
    return this.files.get(filename)!;
  }

  find(filter: Partial<AssetMetadata>): Promise<Asset[]> {
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

  @Test('loads file from resources and verifies saving')
  async loadAndSave() {
    const service = await DependencyRegistry.getInstance(AssetService);

    const filePath = await ResourceManager.toAbsolutePath('/google.png');

    assert(filePath !== undefined);
    assert(filePath.split('.').pop() === 'png');

    let file = await AssetUtil.fileToAsset(filePath);
    file = await service.save(file);

    assert(file.contentType === 'image/png');
    assert(file.size > -1);
  }
}