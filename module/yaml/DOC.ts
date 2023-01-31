import { d, lib } from '@travetto/doc';
import { YamlUtil } from './src/util';

export const text = () => d`
${d.Header()}

In the desire to provide a minimal footprint, the framework provides a minimal ${lib.YAML} parser/serializer to handle standard configuration structure.

${d.Ref(YamlUtil.name, 'src/util.ts')} is the main access point for this module, and will expose two method, ${d.Method('parse')} and ${d.Method('serialize')}.

${d.Code('Simple YAML Parsing', 'doc/parse.ts')}
${d.Execute('Simple YAML Parsing', 'trv', ['main', '@travetto/yaml/doc/parse.ts'], { cwd: './doc-exec' })}

${d.Code('Simple YAML Serialization', 'doc/serialize.ts')}
${d.Execute('Simple YAML Serialization', 'trv', ['main', '@travetto/yaml/doc/serialize.ts'], { cwd: './doc-exec' })}
`;