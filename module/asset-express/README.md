travetto: Asset Express
===

Provides the ability to access file uploads via `express`, and have them registered as `Asset`s on the request (as `req.files`)

```typescript

@Controller('/user')
class Controller {

  @AssetUpload()
  @Post('/avatar')
  async setAvatar(req:Request, res:Response) {
    assert(req.files[0]);
  }
}

```