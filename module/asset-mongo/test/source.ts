import { AssetService, AssetUtil, Asset } from '@encore/asset';
import { timeout } from '@encore/test';
import { expect } from 'chai';
import { DependencyRegistry, Injectable } from '@encore/di';
import * as fs from 'fs';

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
});