import { Controller, Request, Post, Get } from '@travetto/rest';
import { AssetUpload } from '@travetto/asset-rest/src';

@Controller('/simple')
export class Simple {

  @Get('/age')
  getAge() {
    return { age: 20 };
  }

  @Post('/age')
  getPAge() {
    return { age: 20 };
  }

  @AssetUpload()
  @Post('/files')
  loadFiles(req: Request) {
    console.log(req.files);
  }
}