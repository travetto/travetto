import { Node, serialize, parse, parseFragment } from 'parse5';

import { getAttrMap, Adapter, visit, classes, toStr, setDomAttribute, getInner } from './util';

export const COMPONENT_DEFAULTS = {
  button: 'button',
  row: 'row',
  columns: 'columns',
  container: 'container',
  callout: 'callout',
  inky: 'inky',
  'block-grid': 'blockGrid',
  menu: 'menu',
  item: 'menuItem',
  center: 'center',
  spacer: 'spacer',
  wrapper: 'wrapper',
  'h-line': 'hLine'
};

export class ComponentFactory {
  constructor(
    private columnCount: number = 12,
    private componentTags: typeof COMPONENT_DEFAULTS = COMPONENT_DEFAULTS
  ) {
  }

  columns(element: Node) {
    const attrs = getAttrMap(element);
    const inner = getInner(element);

    let expander = '';

    // Add 1 to include current column
    const colCount = Adapter.getChildNodes(element).length;

    // Check for sizes. If no attribute is provided, default to small-12. Divide evenly for large columns
    const smallSize = parseInt(attrs.small || '0', 10) || this.columnCount;
    const largeSize = parseInt(attrs.large || attrs.small || '0', 10) || Math.trunc(this.columnCount / colCount);
    const noExpander = 'no-expander' in attrs && attrs['no-expander'] !== 'false';

    attrs.class = classes(`small-${smallSize}`, `large-${largeSize}`, 'columns', attrs.class);

    delete attrs.large;
    delete attrs.small;
    delete attrs['no-expander'];

    // If the column contains a nested row, the .expander class should not be used
    if (largeSize === this.columnCount && !noExpander) {
      let hasRow = false;
      visit(element, (node, descend) => {
        if (Adapter.getTagName(node) === 'row') {
          hasRow = true;
        } else if (/\brow\b/.test(getAttrMap(node).class || '')) {
          hasRow = true;
        } else {
          descend();
        }
      });
      if (!hasRow) {
        expander = '\n<th class="expander"></th>';
      }
    }

    // Final HTML output
    return `
      <th ${toStr(attrs)}>
        <table>
          <tbody>
            <tr>
              <th>${inner}</th>${expander}
            </tr>
          </tbody>
        </table>
      </th>`;
  }

  hLine(element: Node) {
    const attrs = getAttrMap(element);

    return `
    <table class="${classes('h-line', attrs.class)}">
      <tr><th>&nbsp;</th></tr>
    </table>`;
  }

  row(element: Node) {
    const attrs = getAttrMap(element);
    const inner = getInner(element);

    attrs.class = classes('row', attrs.class);

    return `
    <table ${toStr(attrs)}>
      <tbody>
        <tr>${inner}</tr>
      </tbody>
    </table>`;
  }

  button(element: Node) {
    const attrs = getAttrMap(element);
    let inner = getInner(element);

    const { href, target, class: cls, ...parentAttrs } = attrs;
    let expander = '';
    // If we have the href attribute we can create an anchor for the inner of the button;
    if (href) {
      inner = `<a ${toStr({ href, target })}>${inner}</a>`;
    }

    // If the button is expanded, it needs a <center> tag around the content
    if (/\bexpand(ed)?\b/.test(cls || '')) {
      inner = this.convertAll(`<center>
        ${inner}
      </center>`);
      expander = `\n<td class="expander"></td>`;
    }

    // The .button class is always there, along with any others on the <button> element
    return `
      <table class="${classes('button', cls)}">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <td>
                      ${inner}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>${expander}
          </tr>
        </tbody>
      </table>`;
  }

  container(element: Node) {
    const attrs = getAttrMap(element);
    const inner = getInner(element);

    attrs.class = classes('container', attrs.class);
    attrs.align = 'center';

    return `
    <table ${toStr(attrs)}>
      <tbody>
        <tr><td>${inner}</td></tr>
      </tbody>
    </table>`;

  }

  inky(element: Node) {
    return `
    <tr>
      <td>
        <img src="https://raw.githubusercontent.com/arvida/emoji-cheat-sheet.com/master/public/graphics/emojis/octopus.png" />
      </tr>
    </td>`;
  }

  blockGrid(element: Node) {
    const attrs = getAttrMap(element);
    const inner = getInner(element);

    return `
    <table class="${classes('block-grid', attrs.up ? `up-${attrs.up}` : '', attrs.class)}">
      <tbody>
        <tr>${inner}</tr>
      </tbody>
    </table>`;
  }

  menu(element: Node) {
    const attrs = getAttrMap(element);
    let inner = getInner(element);

    if (inner.trim() && !/<(th|td)/.test(inner)) {
      inner = `<th class="menu-item">${inner}</th>`;
    }

    attrs.class = classes('menu', attrs.class);
    return `
      <table ${toStr(attrs)}>
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    ${inner}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>`;
  }

  menuItem(element: Node) {
    const attrs = getAttrMap(element);
    const inner = getInner(element);

    // Prepare optional target attribute for the <a> element
    attrs.class = classes('menu-item', attrs.class);
    const { href, target, ...parentAttrs } = attrs;
    return `
       <th ${toStr(parentAttrs)}>
         <a ${toStr({ href, target })}>${inner}</a>
       </th>`;
  }

  center(element: Node) {
    for (const child of (Adapter.getChildNodes(element) || [])) {
      if (Adapter.isElementNode(child)) {
        setDomAttribute(child, 'align', 'center');
        setDomAttribute(child, 'class', 'float-center');
      }
    }

    visit(element, (node: Node, descend: () => void) => {
      descend();
      if (Adapter.getTagName(node) === 'item') {
        setDomAttribute(node, 'class', 'float-center');
      } else if (/\bmenu-item\b/.test(getAttrMap(node).class || '')) {
        setDomAttribute(node, 'class', 'float-center');
      }
    });

    const df = Adapter.createDocumentFragment();
    Adapter.appendChild(df, element);
    return serialize(df);
  }

  callout(element: Node) {
    const attrs = getAttrMap(element);
    const inner = getInner(element);

    const cls = classes('callout-inner', attrs.class);
    delete attrs.class;

    return `
      <table ${toStr(attrs)} class="callout">
        <tbody>
          <tr>
            <th class="${cls}">
              ${inner}
            </th>
            <th class="expander"></th>
          </tr>
        </tbody>
      </table>`;
  }

  spacer(element: Node) {
    const attrs = getAttrMap(element);
    const html: string[] = [];

    attrs.class = classes('spacer', attrs.class);

    const smAttr = attrs['size-sm'];
    const lgAttr = attrs['size-lg'];
    const sm = smAttr ? parseInt(smAttr, 10) : undefined;
    const lg = lgAttr ? parseInt(lgAttr, 10) : undefined;

    const buildSpacer = (size: number | string, extraClass: string = '') => {
      const newAttrs = { ...attrs };
      delete newAttrs['size-sm'];
      delete newAttrs['size-lg'];
      delete newAttrs['size'];
      if (extraClass) {
        newAttrs.class += ` ${extraClass}`;
      }
      return `
        <table ${toStr(newAttrs)}>
          <tbody>
            <tr>
              <td height="${size}px" style="font-size:${size}px;line-height:${size}px;">&nbsp;</td>
            </tr>
          </tbody>
        </table>
      `;
    };

    if (sm || lg) {
      if (sm) {
        html.push(buildSpacer(sm, 'hide-for-large'));
      }
      if (lg) {
        html.push(buildSpacer(lg, 'show-for-large'));
      }
    } else {
      html.push(buildSpacer(attrs.size || 16));
    }

    return html.join('\n');
  }

  wrapper(element: Node) {
    const attrs = getAttrMap(element);
    const inner = getInner(element);

    attrs.class = classes('wrapper', attrs.class);
    attrs.align = 'center';

    return `
      <table ${toStr(attrs)}>
        <tbody>
          <tr>
            <td class="wrapper-inner">
              ${inner}
            </td>
          </tr>
        </tbody>
      </table>`;
  }

  generate(element: Node) {
    const tagName = Adapter.getTagName(element);

    if (tagName in this.componentTags) {
      const fnName = (this.componentTags as { [key: string]: string })[tagName];
      const text: string = (this as any)[fnName](element);
      return text.trim();
    } else {
      // If it's not a custom component, return it as-is
      return `<tr><td>${serialize(element)}</td></tr>`;
    }
  }

  convertAll(document: Node): Node;
  convertAll(document: string): string;
  convertAll(document: string | Node): string | Node {
    const traverse = (node: Node) => {
      const children = Adapter.getChildNodes(node) || [];
      let i = -1;
      for (const child of children.slice(0)) {
        i = i + 1;
        const tagName = Adapter.getTagName(child);
        if (!tagName) {
          continue;
        }
        traverse(child);
        if (tagName in this.componentTags) {
          if (tagName === this.componentTags.columns && !('hasColumns' in node)) {
            (node as any).hasColumns = true;
            const all = children.filter(x => Adapter.isElementNode(x));
            setDomAttribute(all[0], 'class', 'first');
            setDomAttribute(all[all.length - 1], 'class', 'last');
          }
          const text = this.generate(child);
          const newFrag = parseFragment(text);
          const newNodes = (Adapter.getChildNodes(newFrag).filter(x => Adapter.isElementNode(x)))!;
          children.splice(i, 1, ...newNodes);
        }
      }
      return node;
    };

    if (typeof document === 'string') {
      const node = document.includes('<html') ? parse(document) : parseFragment(document);
      const ret = traverse(node);
      const out = serialize(ret);
      return out;
    } else {
      return traverse(document);
    }
  }
}