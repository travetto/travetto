/** @jsxImportSource @travetto/email-inky */

import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RuntimeContext } from '@travetto/manifest';
import { Container, If, Unless, Summary, Title, Value, InkyTemplate, wrap } from '../__index__';

@Suite('InkyTemplate')
class ContainerTest {

  @Test('works when rendering an inky template')
  async testFull() {
    const input = <InkyTemplate>
      <Title>My Title</Title>
      <Summary>My Summary</Summary>
      <Container>
        My Email
      </Container>
    </InkyTemplate>;

    const state = {
      ...(await wrap(input))!,
      file: 'test',
      module: RuntimeContext.main.name,
    };

    assert(input);


    assert((await state.subject(state)).trim() === 'My Title');

    assert((await state.html(state)).includes('My Summary'));

    assert(/<head>.*<title>My Title<\/title>.*?<\/head>/gsm.test(((await state.html(state)))));
    assert(/<body>\s*<span id="summary".*?My Summary<\/span>/gsm.test(((await state.html(state)))));
  }

  @Test('works when rendering an inky template with conditionals')
  async verifyConditionals() {
    const input = <InkyTemplate>
      <Title>My Title</Title>
      <Summary>My Summary</Summary>
      <Container>
        {'{{amount}}'}
        <Value attr='amount-two' />
        <If attr='paid'>
          Payment!
        </If>
        <Unless attr='unpaid'>
          No Payment!
        </Unless>
        <Value attr='amount-three' raw={true} />
      </Container>
    </InkyTemplate>;

    const state = {
      ...(await wrap(input))!,
      file: 'test',
      module: RuntimeContext.main.name,
    };

    assert(state);

    const output = await state.html(state);
    assert(/[{]{2}#paid[}]{2}\s*Payment!\s*[{]{2}\/paid[}]{2}/gsm.test(output));
    assert(/[{]{2}[^]unpaid[}]{2}\s*No Payment!\s*[{]{2}\/unpaid[}]{2}/gsm.test(output));
    assert(/[{]{2}amount[}]{2}/gsm.test(output));
    assert(/[{]{2}amount-two[}]{2}/gsm.test(output));
    assert(/[{]{3}amount-three[}]{3}/gsm.test(output));
  }

  @Test('works when including raw styles')
  async verifyStyleUrls() {
    const input = <InkyTemplate>
      <Title>My Title</Title>
      <Container style={'background-image: url(/green.gif)'}>      </Container>
    </InkyTemplate>;

    const state = {
      ...(await wrap(input))!,
      file: 'test',
      module: RuntimeContext.main.name,
    };

    const output = await state.html(state);
    assert(/background-image: url[(][/]green.gif[)]/gsm.test(output));
  }
}
