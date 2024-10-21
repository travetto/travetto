/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module provides functionality for image resizing, and image optimization. This is primarily meant to be used in conjunction with other modules, like the {d.mod('EmailCompiler')} module. It can also be invoked directly as needed (as it can be very handy for batch processing images on the command line). <br />

  <c.Section title='Sharp'>
    The in process operations leverage {d.library('Sharp')} and will perform within expectations, and will execute substantially faster than invoking a subprocess.
  </c.Section>


  <c.Code title='Simple Image Resize' src='doc/resize.ts' />
</>;