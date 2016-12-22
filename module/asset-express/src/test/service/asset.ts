import { AssetService } from '../../lib/service/asset';
import { AssetUtil } from '../../lib/util';
import { expect } from 'chai';
import * as fs from 'fs';

describe('Assect Service', () => {
  it('downloads an file from a url', async () => {
    let filePath = await AssetUtil.downloadUrl('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png')
    expect(filePath).to.not.be.undefined;
    expect(filePath.split('.').pop()).equals('png');
    let file = await AssetUtil.localFileToAsset(filePath);
    file = await AssetService.upload(file);
    expect(file.contentType).equals('image/png');
    expect(file.length).is.greaterThan(0);

    fs.stat(filePath, (err, stats) => {
      expect(err).to.be.instanceof(Error);
      expect(stats).to.be.undefined;
    })
  });
}) 