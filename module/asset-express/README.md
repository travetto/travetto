travetto: Asset-Express
===

Asset Express, provides a clean and direct mechansim for handling uploads via the `express` framework, as well as some best
practices with respect to temporary file deletion.

Once the files are uploaded, they are exposed on `express`'s request object as `req.files`. The uploaded files are constructed as
`Asset` instances, which allows for easy interoperability with the [`Asset`](https://github.io/travetto/asset) module for
storage.

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
  async getAvatar(req:Request) {
    return await this.imageService.get(req.params.path, {w: req.query.w, h: req.query.h});
  }
}
```
