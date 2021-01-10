import { doc as d, lib, Code, mod } from '@travetto/doc';
import { DynamoDBModelConfig } from './src/config';

exports.text = d`
This module provides an ${lib.DynamoDB}-based implementation for the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.DynamoDB}. The entire document is stored as a single value, so nothing is needed to handle schema updates in real time. Indices on the other hand are more complicated, and will not be retroactively computed for new values.

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the service or config, you can override and register it with the ${mod.Di} module.

${Code('Wiring up a custom service', 'doc/custom-service.ts')}

where the ${DynamoDBModelConfig} is defined by:

${Code('Structure of DynamoDBModelConfig', DynamoDBModelConfig.ᚕfile)}
`;