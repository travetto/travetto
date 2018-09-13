import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { cleanseOutput, cleanseTemplate } from './util';

@Suite()
export class CenterComponentTest {
  @Test('applies a text-center class and center alignment attribute to the first child')
  testCenter() {
    const input = `
      <center>
        <div></div>
      </center>
    `;
    const expected = `
      <center>
        <div align="center" class="float-center"></div>
      </center>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('doesn\'t choke if center tags are nested')
  testNested() {
    const input = `
      <center>
        <center>
        </center>
      </center>
    `;

    const expected = `
      <center>
        <center align="center" class="float-center">
        </center>
      </center>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('applies the class float-center to <item> elements')
  testFloat() {
    const input = `
      <center>
        <menu>
          <item href="#"></item>
        </menu>
      </center>
    `;

    const expected = `
      <center>
        <table class="menu float-center" align="center">
          <tbody>
            <tr>
              <td>
                <table>
                  <tbody>
                    <tr>
                      <th class="menu-item float-center">
                        <a href="#"></a>
                      </th>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </center>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}