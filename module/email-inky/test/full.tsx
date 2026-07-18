/** @jsxImportSource @travetto/email-inky/support */

import assert from 'node:assert';

import { Container, If, InkyTemplate, prepare, Summary, Title, Unless, Value } from '@travetto/email-inky';
import { Runtime } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

@Suite('InkyTemplate')
class ContainerTest {
  @Test('works when rendering an inky template')
  async testFull() {
    const input = (
      <InkyTemplate>
        <Title>My Title</Title>
        <Summary>My Summary</Summary>
        <Container>My Email</Container>
      </InkyTemplate>
    );

    const module = await prepare(input, {
      file: 'test',
      module: Runtime.main.name
    });

    assert(input);

    assert((await module.subject()).trim() === 'My Title');

    assert((await module.html()).includes('My Summary'));

    assert(/<head>.*<title>My Title<\/title>.*?<\/head>/gms.test(await module.html()));
    assert(/<body>\s*<span id="summary".*?My Summary<\/span>/gms.test(await module.html()));
  }

  @Test('works when rendering an inky template with conditionals')
  async verifyConditionals() {
    const input = (
      <InkyTemplate>
        <Title>My Title</Title>
        <Summary>My Summary</Summary>
        <Container>
          {'{{amount}}'}
          <Value attr="amount-two" />
          <If attr="paid">Payment!</If>
          <Unless attr="unpaid">No Payment!</Unless>
          <Value attr="amount-three" raw={true} />
        </Container>
      </InkyTemplate>
    );

    const wrapper = await prepare(input, {
      file: 'test',
      module: Runtime.main.name
    });

    const output = await wrapper.html();
    assert(/[{]{2}#paid[}]{2}\s*Payment!\s*[{]{2}\/paid[}]{2}/gms.test(output));
    assert(/[{]{2}\^unpaid[}]{2}\s*No Payment!\s*[{]{2}\/unpaid[}]{2}/gms.test(output));
    assert(/[{]{2}amount[}]{2}/gms.test(output));
    assert(/[{]{2}amount-two[}]{2}/gms.test(output));
    assert(/[{]{3}amount-three[}]{3}/gms.test(output));
  }

  @Test('works when including raw styles')
  async verifyStyleUrls() {
    const input = (
      <InkyTemplate>
        <Title>My Title</Title>
        <Container style={'background-image: url(/green.gif)'}> </Container>
      </InkyTemplate>
    );

    const wrapper = await prepare(input, {
      file: 'test',
      module: Runtime.main.name
    });

    const output = await wrapper.html();
    assert(/background-image: url[(][/]green.gif[)]/gms.test(output));
  }
}
