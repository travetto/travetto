import { d, lib } from '@travetto/doc';
import { YamlUtil } from '@travetto/yaml';

export const text = d`
${d.Header()}

In the desire to provide a minimal footprint, the framework provides a minimal ${lib.YAML} parser/serializer to handle standard configuration structure.

${d.Ref(YamlUtil.name, '@travetto/yaml/src/util.ts')} is the main access point for this module, and will expose two method, ${d.Method('parse')} and ${d.Method('serialize')}.

${d.Code('Simple YAML Parsing', 'src/parse.ts')}
${d.Execute('Simple YAML Parsing', 'src/parse.ts')}

${d.Code('Simple YAML Serialization', 'src/serialize.ts')}
${d.Execute('Simple YAML Serialization', 'src/serialize.ts')}
`;