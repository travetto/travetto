/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module provides a clean and direct mechanism for processing uploads, built upon {d.library('Busboy')}. The module also provides some best practices with respect to temporary file deletion.<br />

  Once the files are uploaded, they are exposed on {d.mod('Rest')}'s request object as {d.field('req.files')}. The uploaded files are constructed as {d.input('File')} instances.<br />

  A simple example:

  <c.Code title='Rest controller with upload support' src='doc/simple-controller.ts' />
</>;