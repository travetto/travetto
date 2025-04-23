/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import { Endpoint } from '@travetto/web';

import { FileMap } from './src/types.ts';
import { Upload } from './src/decorator.ts';

const FileMapContract = toConcrete<FileMap>();

export const text = <>
  <c.StdHeader />
  This module provides a clean and direct mechanism for processing uploads, built upon {d.library('Busboy')}. The module also provides some best practices with respect to temporary file management.<br />

  Once the files are uploaded, they are exposed via {Endpoint} parameters using the {Upload} decorator.  This decorator requires the related field type to be a standard {d.library('NodeFile')} object, or a {FileMapContract}.<br />

  A simple example:

  <c.Code title='Web controller with upload support' src='doc/simple-controller.ts' />
</>;