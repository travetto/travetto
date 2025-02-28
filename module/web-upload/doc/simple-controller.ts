import { Controller, Post, Get, HttpRequest } from '@travetto/web';
import { Upload, UploadAll } from '@travetto/web-upload';

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
   * @param file A file to upload
   */
  @Post('/files')
  @UploadAll()
  async loadFiles({ uploads }: HttpRequest) {
    for (const [, upload] of Object.entries(uploads)) {
      return upload;
    }
  }
}