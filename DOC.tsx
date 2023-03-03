/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  The goal of the framework is to provide a holistic application platform with the a focus on interactive development.

  <c.Section title='Philosophy'>
    The framework relies up five key principles:
    <ul>
      <li><strong>Typescript as a development platform.</strong>  This means the framework is intimately tied to {d.library('Typescript')} and it's compiler.</li>
      <li><strong>Code over configuration.</strong> This means that the framework prefers meta-programming via decorators over configuration.  Code is always the best place to define configuration.</li>
      <li><strong>Do not ask the developer to repeat information.</strong> Specifically, source code transformation (and analysis) is a key element of providing seamless functionality while requiring as little as possible from the person using the framework.</li>
      <li><strong>Strive for a minimal footprint.</strong> When libraries are considered, an overarching goal is to keep the size and quantity of dependencies and functionality to a minimum.  The net result should be as little code as possible, and as few dependencies as possible.</li>
      <li><strong>Development responsiveness is paramount.</strong> The framework should aim for instant feedback when possible to minimize the time between making a change and seeing it.</li>
    </ul>
  </c.Section>
  <c.Section title='Modules'>
    Every module within the framework follows the overarching philosophy.  For the most part each module is as isolated as possible.  The modules are stacked vertically to generally indicate dependencies.  The only exception is for common libraries, which are unrelated.
  </c.Section>
</>;

export const wrap = {
  html: (content: string): string => `
<div class="documentation">
  <h1>The Travetto Framework</h1>
  ${content}
</div>
<app-module-chart></app-module-chart>`,
  md: (content: string): string => `
<h1>
  <sub><img src="./doc/images/logo.png" height="40"></sub>
  The Travetto Framework
</h1>

${content}

![Module Layout](./doc/images/modules.png)`
};