import { doc as d, Code, SnippetLink, lib, fld, mod } from '@travetto/doc';

export const text = d`

This module provides a clean and direct mechanism for processing uploads, built upon ${lib.Busboy}. The module also provides some best practices with respect to temporary file deletion.

Once the files are uploaded, they are exposed on ${mod.Rest}'s request object as ${fld`req.files`}. The uploaded files are constructed as ${SnippetLink('Asset', '@travetto/asset/src/types.ts', /interface Asset/)} instances, which allows for  integration with the ${mod.Asset} module.

A simple example:

${Code('Rest controller with upload support', './doc/simple-controller.ts')}
`;