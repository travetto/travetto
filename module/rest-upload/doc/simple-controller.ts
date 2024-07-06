import { Controller, Post, Get, Request } from '@travetto/rest';
import { Upload, UploadAll } from '@travetto/rest-upload';

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
  loadFile(@Upload() file: File) {
    return file;
  }

  /**
   * @param file A file to upload
   */
  @Post('/files')
  @UploadAll()
  loadFiles({ files }: Request) {
    for (const [, file] of Object.entries(files)) {
      return file;
    }
  }
}