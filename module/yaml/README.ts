import { d, meth, Ref, Library, Code, Execute } from '@travetto/doc';
import { YamlUtil } from './src/util';

export default d`
In the desire to provide a minimal footprint, the framework provides a minimal ${Library('YAML', 'https://yaml.org/')} parser/serializer to handle standard configuration structure.

${Ref(YamlUtil.name, './src/util.ts')} is the main access point for this module, and will expose two method, ${meth`parse`} and ${meth`serialize`}.

${Code('Simple YAML Parsing', 'alt/docs/src/parse.ts')}
${Execute('Simple YAML Parsing', 'alt/docs/src/parse.ts')}

${Code('Simple YAML Serialization', 'alt/docs/src/serialize.ts')}
${Execute('Simple YAML Serialization', 'alt/docs/src/serialize.ts')}
`;