/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';

import { Registry } from './src/registry.ts';
import { type RegistryIndex } from './src/types.ts';

const RegistryIndexContract = toConcrete<RegistryIndex>();

export const text = <>
  <c.StdHeader />

  This module is the backbone for all "discovered" and "registered" behaviors within the framework. This is primarily used for building modules within the framework and not directly useful for application development.

  <c.Section title='Flows'>
    Registration, within the framework flows throw two main use cases:

    <c.SubSection title='Initial Flows'>
      The primary flow occurs on initialization of the application. At that point, the module will:
      <ol>
        <li>Initialize {Registry} and will automatically register/load all relevant files</li>
        <li>As files are imported, decorators within the files will record various metadata relevant to the respective registries</li>
        <li>When all files are processed, the {Registry} is finished, and it will signal to anything waiting on registered data that its free to use it.</li>
      </ol>

      This flow ensures all files are loaded and processed before application starts. A sample registry could like:

      <c.Code title='Sample Registry' src='doc/registry.ts' />

      The registry index is a {RegistryIndexContract} that similar to the {d.mod('Schema')}'s Schema registry and {d.mod('Di')}'s Dependency registry.
    </c.SubSection>
    <c.SubSection title='Live Flow'>
      At runtime, the framework is designed to listen for changes and restart any running processes as needed.
    </c.SubSection>
  </c.Section>
</>;