const { doc: d, Mod, Code, SnippetLink, lib, fld } = require('@travetto/doc');

exports.text = d`

This module provides a clean and direct mechanism for processing uploads, built upon ${lib.Busboy}. The module also provides some best practices with respect to temporary file deletion.

Once the files are uploaded, they are exposed on ${Mod('rest')}'s request object as ${fld`req.files`}. The uploaded files are constructed as ${SnippetLink('Asset', '@travetto/asset/src/types.ts', /interface Asset/)} instances, which allows for  integration with the ${Mod('asset')} module.

A simple example:

${Code('Rest controller with upload support', './doc/simple-controller.ts')}
`;