import { d, lib } from '@travetto/doc';
import { RestApplication } from '@travetto/rest';

export const text = d`
${d.Header()}

The ${lib.Express} module supports AWS lambda integration when installed.  This produces an instance of ${RestApplication} that is able to integrate with AWS appropriately.
`;
