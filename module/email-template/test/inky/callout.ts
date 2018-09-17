import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { cleanseOutput, cleanseTemplate } from './util';

@Suite('Callout')
class CalloutComponentTest {
  @Test('creates a callout with correct syntax')
  testCallout() {
    const input = '<callout>Callout</callout>';
    const expected = `
      <table class="callout">
        <tbody>
          <tr>
            <th class="callout-inner">
              Callout
            </th>
            <th class="expander"></th>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('copies classes to the final HTML')
  testClasses() {
    const input = '<callout class="primary">Callout</callout>';
    const expected = `
      <table class="callout">
        <tbody>
          <tr>
            <th class="callout-inner primary">
              Callout
            </th>
            <th class="expander"></th>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}
