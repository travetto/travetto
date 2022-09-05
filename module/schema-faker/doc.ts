import { d, lib, mod } from '@travetto/doc';
import { Schema } from '@travetto/schema';

export const text = d`
${d.Header()}

In the course of application development, there is often a need to generate fake data on demand. Given all the information that we have about the schemas provided, translating that into data generation is fairly straightforward.  The generation utility is built upon ${lib.Faker}, mapping data types, and various field names into specific ${lib.Faker} generation routines.

By default all types are mapped as-is:

${d.List(
  d`${d.Input('string')}`,
  d`${d.Input('number')}`,
  d`${d.Input('Date')}`,
  d`${d.Input('boolean')}`,
  d`Enumerations as ${d.Input('string')} or ${d.Input('number')} types.`,
  d`Provided regular expressions: ${d.List(
    'email',
    'url',
    'telephone',
    'postalCode',
  )}`,
  d`Sub-schemas as registered via ${Schema} decorators.`
)}

In addition to the general types, the code relies upon name matching to provide additional refinement:

${d.Snippet('Supported Mappings', 'src/faker.ts', /#namesToType/, /\};/)}

An example of this would be:

${d.Code('More complex Schema, used with Faker', 'doc/faker.ts')}
`;