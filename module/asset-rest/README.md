travetto: Asset-Rest
===

This module provides a clean and direct mechanism for processing uploads, built upon [`busboy`](https://github.com/mscdex/busboy).  The module also provides some best practices with respect to temporary file deletion.

Once the files are uploaded, they are exposed on [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest)'s request object as `req.files`. The uploaded files are constructed as `Asset` instances, which allows for integration with the [`Asset`](https://github.com/travetto/travetto/tree/master/module/asset) module.

A simple example:

```typescript
@Controller('/avatar')
class Controller {

  constructor(assetService: AssetService, imageService: ImageService) {}

  @AssetUpload()
  @Post('/')
  async setAvatar(req:Request, res:Response) {
    const stored = await this.assetService.store(req.files[0]);
    return {
      path: stored.path
    };
  }

  @Get('/:path')
  async getAvatar(req:TypedQuery<ImageOptions>) {
    return await this.imageService.get(req.params.path, req.query);
  }
}
```
