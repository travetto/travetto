/** @jsxImportSource @travetto/email-inky */

import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Container, If, Unless, Summary, Title, inkyTpl, Value } from '../__index__';

@Suite('InkyTemplate')
class ContainerTest {

  @Test('works when rendering an inky template')
  async testFull() {
    const input = inkyTpl(<>
      <Title>My Title</Title>
      <Summary>My Summary</Summary>
      <Container>
        My Email
      </Container>
    </>);

    assert(input);

    assert((await input.subject()).trim() === 'My Title');

    assert((await input.html()).includes('My Summary'));

    assert(/<head>.*<title>My Title<\/title>.*?<\/head>/gsm.test(((await input.html()))));
    assert(/<body>\s*<span id="summary".*?My Summary<\/span>/gsm.test(((await input.html()))));
  }

  @Test('works when rendering an inky template with conditionals')
  async verifyConditionals() {
    const input = inkyTpl(<>
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
      </Container>
    </>);


    const output = await input.html();
    assert(/[{]{2}#paid[}]{2}\s*Payment!\s*[{]{2}\/paid[}]{2}/gsm.test(output));
    assert(/[{]{2}[^]unpaid[}]{2}\s*No Payment!\s*[{]{2}\/unpaid[}]{2}/gsm.test(output));
    assert(/[{]{2}amount[}]{2}/gsm.test(output));
    assert(/[{]{2}amount-two[}]{2}/gsm.test(output));
  }
}
