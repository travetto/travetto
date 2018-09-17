import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { cleanseTemplate, cleanseOutput } from './util';

@Suite('Container')
class ContainerTest {

  @Test('works when parsing a full HTML document')
  testFull() {
    const input = `
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <container></container>
        </body>
      </html>
    `;
    const expected = `
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <table align="center" class="container">
            <tbody>
              <tr>
                <td></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a container table')
  testBasic() {
    const input = '<container></container>';
    const expected = `
      <table align="center" class="container">
        <tbody>
          <tr>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}
