import { Controller, Post } from '@travetto/web';
import { type FileMap, Upload } from '@travetto/web-upload';

@Controller('/upload')
export class UploadController {

  @Post('/')
  uploadOne(@Upload() file: File): { name: string; size: number } {
    return { name: file.name, size: file.size };
  }

  @Post('/batch')
  async uploadMany(@Upload() files: FileMap): Promise<{ count: number }> {
    return { count: Object.keys(files).length };
  }
}
