import { d, lib, mod } from '@travetto/doc';

export const text = d`
${d.Header()}

This module provides a clean and direct mechanism for processing uploads, built upon ${lib.Busboy}. The module also provides some best practices with respect to temporary file deletion.

Once the files are uploaded, they are exposed on ${mod.Rest}'s request object as ${d.Field('req.files')}. The uploaded files are constructed as ${d.SnippetLink('Asset', '@travetto/asset/src/types.ts', /interface Asset/)} instances, which allows for  integration with the ${mod.Asset} module.

A simple example:

${d.Code('Rest controller with upload support', './doc/simple-controller.ts')}
`;