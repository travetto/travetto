travetto: Asset-Rest
===

Asset Reste, provides a clean and direct mechanism for processing uploads, as well as some best practices with respect to temporary file deletion.

Once the files are uploaded, they are exposed on [`rest`](https://github.com/travetto/rest)'s request object as `req.files`. The uploaded files are constructed as `Asset` instances, which allows for easy interoperability with the [`Asset`](https://github.com/travetto/asset) module for storage.

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
