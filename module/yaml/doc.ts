import { doc as d, meth, Ref, Code, Execute, lib } from '@travetto/doc';
import { YamlUtil } from './src/util';

exports.text = d`
In the desire to provide a minimal footprint, the framework provides a minimal ${lib.YAML} parser/serializer to handle standard configuration structure.

${Ref(YamlUtil.name, 'src/util.ts')} is the main access point for this module, and will expose two method, ${meth`parse`} and ${meth`serialize`}.

${Code('Simple YAML Parsing', 'doc/parse.ts')}
${Execute('Simple YAML Parsing', 'parse.ts')}

${Code('Simple YAML Serialization', 'doc/serialize.ts')}
${Execute('Simple YAML Serialization', 'serialize.ts')}
`;