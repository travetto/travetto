travetto: Image
===


**Install: primary**
```bash
$ npm install @travetto/image
```

This module provides functionality for image resizing, and png optimization. This is primarily meant to be used in conjunction with other modules, like the [`Asset`](https://github.com/travetto/travetto/tree/master/module/asset) module or the [`Email Template`](https://github.com/travetto/travetto/tree/master/module/email-template) module. It can also be invoked directly as needed (as it can be very handy for batch processing images on the command line).

The utility's primary structure revolves around the `CommandService` from the [`Exec`](https://github.com/travetto/travetto/tree/master/module/exec) module.  The `CommandService`  allows for declaration of a local executable, and a fall-back docker container (mainly meant for development).  The `ImageUtil` utilizes [`ImageMagick`](https://imagemagick.org/index.php), and [`pngquant`](https://pngquant.org/) as the backing for image resizing and png compression, respectively.

**Code: Simple Image Resize**
```typescript
class Service {
  async resizeImage(imgPath: string, width: number, height: number): Promise<string> {
    const stream = await ImageUtil.resize(imgPath, { w: width, h: height});
    const out = imgPath.replace(/[.][^.]+$/, (ext) => `.resized${ext}`);
    await SystemUtil.streamToFile(stream, out);
    return out;
  }
}
```