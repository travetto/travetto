/** @jsxImportSource @travetto/doc/support */
import { c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module centralizes synthesized LLM guidance across Travetto modules. It is intended for internal knowledge orchestration and task-oriented assistance, not as a replacement for module README documentation.

  <c.Section title='Primary Outcome'>
    The synthesized guidance combines consumer and maintainer LLM docs into pragmatic workflows with package install recommendations and command-discovery guardrails.
  </c.Section>

  <c.Section title='Install Guidance Strategy'>
    Guidance is provided in two complementary views:
    <ul>
      <li>Task bundles for common framework goals.</li>
      <li>Dependency graph views with optional adapter modules.</li>
    </ul>
  </c.Section>

  <c.Section title='Packaged Consumer Docs'>
    The package builds a bundled consumer-docs source file at pack time so downstream tooling can access all consumer LLM docs through a single exported structure.
  </c.Section>

  <c.Section title='CLI Schema Rule'>
    When command signatures are uncertain, use CLI schema output as source of truth before recommending command arguments.
  </c.Section>
</>;