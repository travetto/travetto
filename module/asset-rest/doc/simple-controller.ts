import { Controller, Post, Get, Request } from '@travetto/rest';
import { Asset } from '@travetto/asset';
import { AssetRestUtil, Upload, UploadAll } from '@travetto/asset-rest';

@Controller('/simple')
export class Simple {

  @Get('/age')
  getAge() {
    return { age: 50 };
  }

  @Post('/age')
  getPage() {
    return { age: 20 };
  }

  /**
   * @param file A file to upload
   */
  @Post('/file')
  loadFile(@Upload() file: Asset) {
    return AssetRestUtil.downloadable(file);
  }

  /**
 * @param file A file to upload
 */
  @Post('/files')
  @UploadAll()
  loadFiles({ files }: Request) {
    for (const [, file] of Object.entries(files)) {
      return AssetRestUtil.downloadable(file); // return the first
    }
  }
}