import { doc as d, Image, List, Section } from '@travetto/doc';

export const header = false;
export const toc = false;
export const text = d`
The goal of the framework is to provide a holistic application platform with the a focus on interactive development.

${Section('Philosophy')}
The framework relies up five key principles:
${List(
  d`**Typescript as a development platform.**  This means the framework is intimately tied to typescript and it's compiler.`,
  d`**Code over configuration.**  This means that the framework prefers meta-programming via decorators over configuration.  Code is always the best place to define configuration.`,
  d`**Do not ask the developer to repeat information.**  Specifically, source code transformation (and analysis) is a key element of providing seamless functionality while requiring as little as possible from the person using the framework.`,
  d`**Strive for a minimal footprint.**  When libraries are considered, an overarching goal is to keep the size and quantity of dependencies and functionality to a minimum.  The net result should be as little code as possible, and as few dependencies as possible.`,
  d`**Development responsiveness is paramount.**  The framework should aim for instant feedback when possible to minimize the time between making a change and seeing it.  `,
)}

${Section('Modules')}
Every module within the framework follows the overarching philosophy.  For the most part each module is as isolated as possible.  The modules are stacked vertically to generally indicate dependencies.  The only exception is for common libraries, which are unrelated.
`;

export const wrap = {
  html: (body: string) => `
<div class="documentation">
  ${body}
</div>
<app-module-chart></app-module-chart>`,
  md: (body: string) => `
<h1>   
  <sub><img src="./docs/images/logo.png" height="40"></sub>
  The Travetto Framework
</h1>
${body}
![Module Layout]('./docs/images/modules.png')
`
};