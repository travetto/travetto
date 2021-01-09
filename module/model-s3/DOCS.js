const { doc: d, Mod, Code, Note, inp, lib } = require('@travetto/doc');
const { AssetSource } = require('@travetto/asset');
const { Config } = require('@travetto/config');

exports.text = d`

This provides a ${lib.S3} implementation of the ${AssetSource} which is a backend for the ${Mod('asset')} module.  

${Code('S3 backend wiring', 'doc/config.ts')}

There is a default configuration that you can easily use, with some sensible defaults. 
 
${Code('S3 Configuration', 'src/config.ts')}

Additionally, you can see that the class is registered with the ${Config} annotation, and so these values can be overridden using the standard ${Mod('config')} resolution paths. 

${Note(d`
  Do not commit your ${inp`accessKeyId`} or ${inp`secretAccessKey`} values to your source repository, especially if it is public facing.  Not only is it a security risk, but Amazon will scan public repos, looking for keys, and if found will react swiftly.
`)}

`;
