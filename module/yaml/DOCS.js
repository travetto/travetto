const { doc: d, meth, Ref, Code, Execute, lib } = require('@travetto/doc');
const { YamlUtil } = require('./src/util');

exports.text = d`
In the desire to provide a minimal footprint, the framework provides a minimal ${lib.YAML} parser/serializer to handle standard configuration structure.

${Ref(YamlUtil.name, './src/util.ts')} is the main access point for this module, and will expose two method, ${meth`parse`} and ${meth`serialize`}.

${Code('Simple YAML Parsing', 'doc/parse.ts')}
${Execute('Simple YAML Parsing', 'doc/parse.ts')}

${Code('Simple YAML Serialization', 'doc/serialize.ts')}
${Execute('Simple YAML Serialization', 'doc/serialize.ts')}
`;