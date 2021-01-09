const { doc: d, Mod, lib, Code } = require('@travetto/doc');
const { CommandService } = require('@travetto/command');
const { ImageUtil } = require('./src/util');


exports.text = d`
This module provides functionality for image resizing, and png optimization. This is primarily meant to be used in conjunction with other modules, like the ${Mod('asset')} module or the ${Mod('email-template')} module. It can also be invoked directly as needed (as it can be very handy for batch processing images on the command line).

The utility's primary structure revolves around the ${CommandService} from the ${Mod('command')} module.  The ${CommandService}  allows for declaration of a local executable, and a fall-back docker container (mainly meant for development).  The ${ImageUtil} utilizes ${lib.ImageMagick}, ${lib.PngQuant}, and  ${lib.JpegOptim} as the backing for image resizing and png compression, respectively.

${Code('Simple Image Resize', 'doc/resize.ts')}
`;