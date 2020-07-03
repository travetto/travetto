# Image
## Image support, resizing, and optimization

**Install: @travetto/image**
```bash
npm install @travetto/image
```

This module provides functionality for image resizing, and png optimization. This is primarily meant to be used in conjunction with other modules, like the [Asset](https://github.com/travetto/travetto/tree/1.0.0-dev/module/asset "Modular library for storing and retrieving binary assets") module or the [Email Templating](https://github.com/travetto/travetto/tree/1.0.0-dev/module/email-template "Email templating module") module. It can also be invoked directly as needed (as it can be very handy for batch processing images on the command line).

The utility's primary structure revolves around the [CommandService](https://github.com/travetto/travetto/tree/1.0.0-dev/module/command/src/command.ts#L11) from the [Command](https://github.com/travetto/travetto/tree/1.0.0-dev/module/command "Support for executing complex commands at runtime.") module.  The [CommandService](https://github.com/travetto/travetto/tree/1.0.0-dev/module/command/src/command.ts#L11)  allows for declaration of a local executable, and a fall-back docker container (mainly meant for development).  The [ImageUtil](https://github.com/travetto/travetto/tree/1.0.0-dev/module/image/src/util.ts#L28) utilizes [ImageMagick](https://imagemagick.org/index.php), [pngquant](https://pngquant.org/), and  [Jpegoptim](https://github.com/tjko/jpegoptim) as the backing for image resizing and png compression, respectively.

**Code: Simple Image Resize**
```typescript
import * as fs from 'fs';

import { StreamUtil } from '@travetto/boot';
import { ImageUtil } from '@travetto/image/src/util';

export class ResizeService {
  async resizeImage(imgPath: string, width: number, height: number): Promise<string> {
    const stream = await ImageUtil.resize(fs.createReadStream(imgPath), { w: width, h: height });
    const out = imgPath.replace(/[.][^.]+$/, (ext) => `.resized${ext}`);
    await StreamUtil.writeToFile(stream, out);
    return out;
  }
}
```

