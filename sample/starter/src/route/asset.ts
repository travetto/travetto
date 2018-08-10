import { Request, Response } from 'express';
import { Get, Post, Controller, Cache } from '@travetto/express';
import { AssetService, ImageService, AssetFile, AssetUtil } from '@travetto/asset';
import { AssetUpload } from '@travetto/asset-express';
import { Inject } from '@travetto/di';

@Controller('/asset')
class AssetRoute {

  @Inject()
  image: ImageService;

  @Inject()
  asset: AssetService;

  @Cache(1, 'y')
  @Get(/(.*).(png|jpg|jpeg|gif|bmp)/i)
  async getImage(req: Request) {
    return await this.image.getImage(req.path, req.query);
  }

  @Cache(1, 'y')
  @Get(/(.*)/)
  async get(req: Request) {
    return await this.asset.get(req.path);
  }

  @Post('/')
  @AssetUpload()
  async upload(req: Request) {
    const file = Object.values((req as any).files)[0] as AssetFile;
    const res = await this.asset.save(AssetUtil.fileToAsset(file));
    return { ...res };
  }
}