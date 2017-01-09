import { AssetService, ImageService } from '../../lib/service';
import { AssetUtil } from '../../lib/util';
import { timeout } from '@encore/test';
import { expect } from 'chai';
import * as fs from 'fs';

describe('Assect Service', () => {
  it('downloads an file from a url', async () => {
    let filePath = await AssetUtil.downloadUrl('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png');
    expect(filePath).to.not.be.undefined;
    expect(filePath.split('.').pop()).equals('png');
    let file = await AssetUtil.localFileToAsset(filePath);
    file = await AssetService.upload(file);
    expect(file.contentType).equals('image/png');
    expect(file.length).is.greaterThan(0);

    fs.stat(filePath, (err, stats) => {
      expect(err).to.be.instanceof(Error);
      expect(stats).to.be.undefined;
    });
  });

  it('Test caching', timeout(10000, async () => {
    let filePath = await AssetUtil.downloadUrl('https://image.freepik.com/free-icon/apple-logo_318-40184.jpg');
    expect(filePath).to.not.be.undefined;
    expect(filePath.split('.').pop()).equals('jpg');
    let file = await AssetUtil.localFileToAsset(filePath);
    file = await AssetService.upload(file);

    let asset = await AssetService.get(file.filename);
    expect(asset).to.not.be.null;

    let start = Date.now();
    let resized = await ImageService.getImage(file.filename, { w: 10, h: 10 });
    let diff = Date.now() - start;

    start = Date.now();
    resized = await ImageService.getImage(file.filename, { w: 10, h: 10 });
    let diff2 = Date.now() - start;

    expect(diff2).to.be.lessThan(diff);
  }));
});