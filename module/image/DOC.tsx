/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { CommandOperation } from '@travetto/command';

import { ImageUtil } from '@travetto/image';

export const text = <>
  <c.StdHeader />
  This module provides functionality for image resizing, and png optimization. This is primarily meant to be used in conjunction with other modules, like the {d.mod('EmailCompiler')} module. It can also be invoked directly as needed (as it can be very handy for batch processing images on the command line). <br />

  The {ImageUtil} functionality supports two operation modes:

  <ul>
    <li>In-process operations using {d.library('Sharp')}</li>
    <li>Out-of-process operations using {d.library('ImageMagick')},
      {d.library('PngQuant')} and {d.library('JpegOptim')}.
    </li>
  </ul>

  <c.Section title='In-Process'>
    The in process operations leverage {d.library('Sharp')} and will perform within expectations, and will execute substantially faster than invoking a subprocess.  The primary caveats here being that {d.library('JpegOptim')} and {d.library('PngQuant')} are better geared for image optimization.  Additionally, by running these processes in-memory, there will be shared contention within the process.
  </c.Section>

  <c.Section title='Out-of-Process'>
    The out-of-process executions will leverage external tools ({d.library('ImageMagick')},
    {d.library('PngQuant')} and {d.library('JpegOptim')}) via {CommandOperation}s.  These tools are tried and tested, but come with the overhead of invoking a separate process to operate.  The benefit here is externalized memory usage, and a more robust optimization flow.
  </c.Section>

  <c.Code title='Simple Image Resize' src='doc/resize.ts' />
</>;