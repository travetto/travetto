/** @jsxImportSource @travetto/email-inky */

import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { renderJSX } from './util';
import { Row, Column, BlockGrid } from '../src/components';

@Suite('Grid')
class GridTest {

  @Test('creates a row')
  async testRow() {
    const input = <Row></Row>;
    const expected = <>
      <table className="row">
        <tbody>
          <tr></tr>
        </tbody>
      </table>
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a single column with first and last classes')
  async testSingleColumn() {
    const input = <Column large={12} small={12}>One</Column>;
    const expected = <th className="first last small-12 large-12 columns">
      <table>
        <tbody>
          <tr>
            <th>One</th>
            <th className="expander"></th>
          </tr>
        </tbody>
      </table >
    </th >;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a single column with first and last classes with no-expander')
  async testNoExpanderImplicit() {
    const input = <Column large={12} small={12} noExpander={true}>One</Column>;
    const expected = <th className="first last small-12 large-12 columns">
      <table>
        <tbody>
          <tr>
            <th>One</th>
          </tr>
        </tbody>
      </table>
    </th >;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a single column with first and last classes with no-expander="false"')
  async testWithExpander() {
    const input = <Column large={12} small={12} noExpander={false}>One</Column>;
    const expected = <th className="first last small-12 large-12 columns">
      <table>
        <tbody>
          <tr>
            <th>One</th>
            <th className="expander"></th>
          </tr>
        </tbody>
      </table >
    </th >;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a single column with first and last classes with no-expander="true"')
  async testNoExpanderExplicit() {
    const input = <Column large={12} small={12} noExpander={true}>One</Column>;
    const expected = <th className="first last small-12 large-12 columns">
      <table>
        <tbody>
          <tr>
            <th>One</th>
          </tr>
        </tbody>
      </table>
    </th >;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates two columns, one first, one last')
  async testTwoColumn() {
    const input = <>
      <Column large={6} small={12}>One</Column>
      <Column large={6} small={12}>Two</Column>
    </>;
    const expected = <>
      <th className="first small-12 large-6 columns">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th className="last small-12 large-6 columns" >
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th >
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates one columns, with offset')
  async testColumnOffset() {
    const input = <>
      <Column large={6} largeOffset={6}>One</Column>
    </>;
    const expected =
      <th className="first last small-12 large-6 columns large-offset-6">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th >;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates 3+ columns, first is first, last is last')
  async testThreeColumn() {
    const input = <>
      <Column large={4} small={12}>One</Column>
      <Column large={4} small={12}>Two</Column>
      <Column large={4} small={12}>Three</Column>
    </>;
    const expected = <>
      <th className="first small-12 large-4 columns">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th className="small-12 large-4 columns" >
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th >
      <th className="last small-12 large-4 columns" >
        <table>
          <tbody>
            <tr>
              <th>Three</th>
            </tr>
          </tbody>
        </table>
      </th >
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('transfers classes to the final HTML')
  async testClasses() {
    const input = <Column smallOffset={8} hideSmall={true}>One</Column>;
    const expected = <th className="first last small-12 large-12 columns small-offset-8 hide-for-small">
      <table>
        <tbody>
          <tr>
            <th>One</th>
            <th className="expander"></th>
          </tr>
        </tbody>
      </table >
    </th >;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('automatically assigns large columns if no large attribute is assigned')
  async testSizingLarge() {
    const input = <>
      <Column small={4}>One</Column>
      <Column small={8}>Two</Column>
    </>;
    const expected = <>
      <th className="first small-4 large-4 columns">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th className="last small-8 large-8 columns" >
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th >
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('automatically assigns small columns as full width if only large defined')
  async testSizingSmall() {
    const input = <>
      <Column large={4}>One</Column>
      <Column large={8}>Two</Column>
    </>;
    const expected = <>
      <th className="first small-12 large-4 columns">
        <table>
          <tbody>
            <tr>
              <th>One</th>
            </tr>
          </tbody>
        </table>
      </th>
      <th className="last small-12 large-8 columns" >
        <table>
          <tbody>
            <tr>
              <th>Two</th>
            </tr>
          </tbody>
        </table>
      </th >
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('supports nested grids')
  async testNested() {
    const input = <Row><Column><Row></Row></Column></Row>;
    const expected = <>
      <table className="row">
        <tbody>
          <tr>
            <th className="first last small-12 large-12 columns">
              <table>
                <tbody>
                  <tr>
                    <th>
                      <table className="row">
                        <tbody>
                          <tr></tr>
                        </tbody>
                      </table>
                    </th>
                  </tr>
                </tbody>
              </table>
            </th>
          </tr>
        </tbody >
      </table >
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('transfers attributes to the final HTML')
  async testAttributes() {
    const input = <Row dir="rtl"><Column dir="rtl" valign="middle" align="center">One</Column></Row>;
    const expected = <>
      <table dir="rtl" className="row">
        <tbody>
          <tr>
            <th dir="rtl" valign="middle" align="center" className="first last small-12 large-12 columns">
              <table>
                <tbody>
                  <tr>
                    <th>One</th>
                    <th className="expander"></th>
                  </tr>
                </tbody>
              </table>
            </th>
          </tr>
        </tbody>
      </table>
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('returns the correct block grid syntax')
  async testBlockGridBasic() {
    const input = <BlockGrid up={4}></BlockGrid>;
    const expected = <table className="block-grid up-4">
      <tbody>
        <tr></tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('copies classes to the final HTML output for block grid')
  async testBlockGridClasses() {
    const input = <BlockGrid up={4} className="show-for-large"></BlockGrid>;
    const expected = <table className="show-for-large block-grid up-4">
      <tbody>
        <tr></tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}