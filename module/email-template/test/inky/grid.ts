import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { cleanseTemplate, cleanseOutput } from './util';

@Suite('Grid')
class GridTest {

  @Test('creates a row')
  testRow() {
    const input = '<row></row>';
    const expected = `
      <table class="row">
        <tbody>
          <tr></tr>
        </tbody>
      </table>&zwj;
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a single column with first and last classes')
  testSingleColumn() {
    const input = '<columns large="12" small="12">One</columns>';
    const expected = `
      <th class="small-12 large-12 columns first last">
        <table>
          <tbody>
            <tr>
              <th>One</th>
              <th class="expander"></th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a single column with first and last classes with no-expander')
  testNoExpanderImplicit() {
    const input = '<columns large="12" small="12" no-expander>One</columns>';
    const expected = `
      <th class="small-12 large-12 columns first last">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a single column with first and last classes with no-expander="false"')
  testWithExpander() {
    const input = '<columns large="12" small="12" no-expander="false">One</columns>';
    const expected = `
      <th class="small-12 large-12 columns first last">
        <table>
          <tbody>
            <tr>
              <th>One</th>
              <th class="expander"></th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a single column with first and last classes with no-expander="true"')
  testNoExpanderExplicit() {
    const input = '<columns large="12" small="12" no-expander="true">One</columns>';
    const expected = `
      <th class="small-12 large-12 columns first last">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates two columns, one first, one last')
  testTwoColumns() {
    const input = `
      <columns large="6" small="12">One</columns>
      <columns large="6" small="12">Two</columns>
    `;
    const expected = `
      <th class="small-12 large-6 columns first">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th class="small-12 large-6 columns last">
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates 3+ columns, first is first, last is last')
  testThreeColumns() {
    const input = `
      <columns large="4" small="12">One</columns>
      <columns large="4" small="12">Two</columns>
      <columns large="4" small="12">Three</columns>
    `;
    const expected = `
      <th class="small-12 large-4 columns first">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th class="small-12 large-4 columns">
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th class="small-12 large-4 columns last">
        <table>
          <tbody>
            <tr>
              <th>Three</th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('transfers classes to the final HTML')
  testClasses() {
    const input = '<columns class="small-offset-8 hide-for-small">One</columns>';
    const expected = `
      <th class="small-12 large-12 columns small-offset-8 hide-for-small first last">
        <table>
          <tbody>
            <tr>
              <th>One</th>
              <th class="expander"></th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('automatically assigns large columns if no large attribute is assigned')
  testSizingLarge() {
    const input = `
      <columns small="4">One</columns>
      <columns small="8">Two</columns>
    `;
    const expected = `
      <th class="small-4 large-4 columns first">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th class="small-8 large-8 columns last">
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('automatically assigns small columns as full width if only large defined')
  testSizingSmall() {
    const input = `
      <columns large="4">One</columns>
      <columns large="8">Two</columns>
    `;
    const expected = `
      <th class="small-12 large-4 columns first">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th class="small-12 large-8 columns last">
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('supports nested grids')
  testNested() {
    const input = '<row><columns><row></row></columns></row>';
    const expected = `
      <table class="row">
        <tbody>
          <tr>
            <th class="small-12 large-12 columns first last">
              <table>
                <tbody>
                  <tr>
                    <th>
                      <table class="row">
                        <tbody>
                          <tr></tr>
                        </tbody>
                      </table>&zwj;
                    </th>
                  </tr>
                </tbody>
              </table>
            </th>
          </tr>
        </tbody>
      </table>&zwj;
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('transfers attributes to the final HTML')
  testAttributes() {
    const input = '<row dir="rtl"><columns dir="rtl" valign="middle" align="center">One</columns></row>';
    const expected = `
      <table class="row" dir="rtl">
        <tbody>
          <tr>
            <th align="center" class="small-12 large-12 columns first last" dir="rtl" valign="middle">
              <table>
                <tbody>
                  <tr>
                    <th>One</th>
                    <th class="expander"></th>
                  </tr>
                </tbody>
              </table>
            </th>
          </tr>
        </tbody>
      </table>&zwj;
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('returns the correct block grid syntax')
  testBlockGridBasic() {
    const input = '<block-grid up="4"></block-grid>';
    const expected = `
      <table class="block-grid up-4">
        <tbody>
          <tr></tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('copies classes to the final HTML output for block grid')
  testBlockGridClasses() {
    const input = '<block-grid up="4" class="show-for-large"></block-grid>';
    const expected = `
      <table class="block-grid up-4 show-for-large">
        <tbody>
          <tr></tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}