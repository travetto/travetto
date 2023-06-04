/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { CommandOperation } from '@travetto/command';

import { ImageConverter } from '@travetto/image';

export const text = <>
  <c.StdHeader />
  This module provides functionality for image resizing, and png optimization. This is primarily meant to be used in conjunction with other modules, like the {d.mod('Asset')} module or the {d.mod('EmailCompiler')} module. It can also be invoked directly as needed (as it can be very handy for batch processing images on the command line). <br />

  The utility's primary structure revolves around the {CommandOperation} from the {d.mod('Command')} module.  The {CommandOperation}  allows for declaration of a local executable, and a fall-back docker container (mainly meant for development).  The {ImageConverter} utilizes {d.library('ImageMagick')}, {d.library('PngQuant')}, and  {d.library('JpegOptim')} as the backing for image resizing and png compression, respectively.

  <c.Code title='Simple Image Resize' src='doc/resize.ts' />
</>;