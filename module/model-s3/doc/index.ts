import { d, mod, lib } from '@travetto/doc';
import { ModelCustomConfig } from '@travetto/model/support/doc.support';

import { S3ModelConfig } from '@travetto/model-s3/src/config';

export const text = () => d`
${d.Header()}

This module provides an ${lib.S3}-based implementation for the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and stream against ${lib.S3}.

${ModelCustomConfig(S3ModelConfig)}

${d.Note(d`
  Do not commit your ${d.Input('accessKeyId')} or ${d.Input('secretAccessKey')} values to your source repository, especially if it is public facing.  Not only is it a security risk, but Amazon will scan public repos, looking for keys, and if found will react swiftly.
`)}
`;
