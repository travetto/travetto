import { Controller, Request, Post } from '@travetto/rest';
import { AssetUpload } from '@travetto/asset-rest/src';

@Controller('/simple')
export class Simple {

  @AssetUpload()
  @Post('/files')
  loadFiles(req: Request) {
    console.log(req.files);
  }
}