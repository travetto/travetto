import { Controller, Post, Get } from '@travetto/web';
import { type UploadMap, Upload } from '@travetto/web-upload';

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
  loadFile(@Upload() upload: File) {
    return upload;
  }

  /**
   * @param uploads A map of files that were uploaded
   */
  @Post('/files')
  async loadFiles(@Upload() uploads: UploadMap) {
    for (const [, upload] of Object.entries(uploads)) {
      return upload;
    }
  }
}