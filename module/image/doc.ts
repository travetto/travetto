import { d, mod, lib } from '@travetto/doc';
import { CommandService } from '@travetto/command';

import { ImageConverter } from './src/convert';

export const text = d`
${d.Header()}

This module provides functionality for image resizing, and png optimization. This is primarily meant to be used in conjunction with other modules, like the ${mod.Asset} module or the ${mod.EmailTemplate} module. It can also be invoked directly as needed (as it can be very handy for batch processing images on the command line).

The utility's primary structure revolves around the ${CommandService} from the ${mod.Command} module.  The ${CommandService}  allows for declaration of a local executable, and a fall-back docker container (mainly meant for development).  The ${ImageConverter} utilizes ${lib.ImageMagick}, ${lib.PngQuant}, and  ${lib.JpegOptim} as the backing for image resizing and png compression, respectively.

${d.Code('Simple Image Resize', 'doc/resize.ts')}
`;