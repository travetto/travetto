/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module provides a clean and direct mechanism for processing uploads, built upon {d.library('Busboy')}. The module also provides some best practices with respect to temporary file deletion.<br />

  Once the files are uploaded, they are exposed on {d.mod('Web')}'s request object. The uploaded files are constructed as {d.input('Blob')} instances.<br />

  A simple example:

  <c.Code title='Web controller with upload support' src='doc/simple-controller.ts' />
</>;