import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { cleanseOutput, cleanseTemplate } from './util';

@Suite('simple')
class SimpleComponentTest {

  @Test('creates a wrapper that you can attach classes to')
  testWrapper() {
    const input = `<wrapper class="header"></wrapper>`;
    const expected = `
      <table align="center" class="wrapper header">
        <tbody>
          <tr>
            <td class="wrapper-inner">
            </td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a horizontal rule that you can attach classes to')
  testHLine() {
    const input = `<h-line class="dotted">`;
    const expected = `
      <table class="h-line dotted">
        <tbody>
          <tr>
            <th>&nbsp;</th>
          </tr>
        </tbody>
      </table>
    `;
    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a wrapper that ignores anything inside')
  testRaw() {
    const input = `<raw><<LCG Program\TG LCG Coupon Code Default='246996'>></raw>`;
    const expected = `<<LCG Program\TG LCG Coupon Code Default='246996'>>`;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}