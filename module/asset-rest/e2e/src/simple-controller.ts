import * as fs from 'fs';

import { Controller, Post, Get } from '@travetto/rest';
import { Asset } from '@travetto/asset';

import { Upload } from '../../src/decorator';
import { UploadUtil } from '../../src/upload-util';

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
   * @param file - A file to upload
   */
  @Post('/files')
  loadFiles(@Upload() file: Asset) {
    return UploadUtil.downloadable(file);
  }
}