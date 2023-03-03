/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Schema } from '@travetto/schema';

export const text = <>
  <c.StdHeader />
  In the course of application development, there is often a need to generate fake data on demand. Given all the information that we have about the schemas provided, translating that into data generation is fairly straightforward.  The generation utility is built upon {d.library('Faker')}, mapping data types, and various field names into specific {d.library('Faker')} generation routines. <br />

  By default all types are mapped as-is:

  <ul>
    <li>{d.input('string')}</li>
    <li>{d.input('number')}</li>
    <li>{d.input('Date')}</li>
    <li>{d.input('boolean')}</li>
    <li>Enumerations as {d.input('string')} or {d.input('number')} types.</li>
    <li>Provided regular expressions:</li>
    <ul>
      <li>email</li>
      <li>url</li>
      <li>telephone</li>
      <li>postalCode</li>
    </ul>
    <li>Sub-schemas as registered via {Schema} decorators</li>
  </ul>

  In addition to the general types, the code relies upon name matching to provide additional refinement:

  <c.Code title='Supported Mappings' src='src/faker.ts' startRe={/#namesToType/} endRe={/\};/} />

  An example of this would be:

  <c.Code title='More complex Schema, used with Faker' src='doc/faker.ts' />
</>;