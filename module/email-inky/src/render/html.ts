import { JSXElement } from '@travetto/email-inky/jsx-runtime';
import { EmailResource } from '@travetto/email';

import { RenderProvider, RenderState } from '../types';
import { RenderContext } from './context';
import { classStr, combinePropsToStr, getKids, isOfType, visit } from './common';

export const SUMMARY_STYLE = Object.entries({
  display: 'none',
  'font-size': '1px',
  color: '#333333',
  'line-height': '1px',
  'max-height': '0px',
  'max-width': '0px',
  opacity: '0',
  overflow: 'hidden'
}).map(([k, v]) => `${k}: ${v}`).join('; ');

const allowedProps = new Set([
  'class', 'id', 'dir', 'name', 'src',
  'alt', 'href', 'title', 'height', 'target',
  'width', 'style', 'align', 'valign'
]);

const propsToStr = combinePropsToStr.bind(null, allowedProps);

const stdInline = async ({ recurse, el }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `<${el.type} ${propsToStr(el.props)}>${await recurse()}</${el.type}>`;

const std = async (state: RenderState<JSXElement, RenderContext>): Promise<string> => `${await stdInline(state)}\n`;
const stdFull = async (state: RenderState<JSXElement, RenderContext>): Promise<string> => `\n${await stdInline(state)}\n`;

export const Html: RenderProvider<RenderContext> = {
  finalize: async (html, context, isRoot = false) => {
    html = html
      .replace(/(<[/](?:a)>)([A-Za-z0-9$])/g, (_, tag, v) => `${tag} ${v}`)
      .replace(/(<[uo]l>)(<li>)/g, (_, a, b) => `${a} ${b}`);

    if (isRoot) {
      const wrapper = await new EmailResource([`${context.module}#resources`, '@travetto/email-inky#resources'])
        .read('/email/inky.wrapper.html');

      // Get Subject
      const headerTop: string[] = [];
      const bodyTop: string[] = [];

      // Force summary to top, and title to head
      const final = wrapper
        .replace('<!-- BODY -->', html)
        .replace(/<title>.*?<\/title>/, a => { headerTop.push(a); return ''; })
        .replace(/<span[^>]+id="summary"[^>]*>(.*?)<\/span>/sm, a => { bodyTop.push(a); return ''; })
        .replace(/<head( [^>]*)?>/, t => `${t}\n${headerTop.join('\n')}`)
        .replace(/<body[^>]*>/, t => `${t}\n${bodyTop.join('\n')}`);

      // Allow tag suffixes/prefixes via comments
      html = final
        .replace(/\s*<!--\s*[$]:([^ -]+)\s*-->\s*(<\/[^>]+>)/g, (_, suf, tag) => `${tag}${suf}`)
        .replace(/(<[^\/][^>]+>)\s*<!--\s*[#]:([^ ]+)\s*-->\s*/g, (_, tag, pre) => `${pre}${tag}`);
    }

    return html;
  },

  For: async ({ recurse, props }) => `{{#${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  If: async ({ recurse, props }) => `{{#${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  Unless: async ({ recurse, props }) => `{{^${props.attr}}}${await recurse()}{{/${props.attr}}}`,
  Value: async ({ props }) => `{{${props.attr}}}`,

  br: async () => '<br>\n',
  hr: async (el) => `<table ${propsToStr(el.props)}><th></th></table>`,
  strong: stdInline, em: stdInline, p: stdFull,
  h1: stdFull, h2: stdFull, h3: stdFull, h4: stdFull,
  li: std, ol: stdFull, ul: stdFull,
  table: stdFull, thead: std, tr: std, td: std, th: std, tbody: std, center: std, img: stdInline,
  title: std,
  div: std, span: stdInline, small: stdInline,
  a: async ({ recurse, props }) => `<a ${propsToStr(props)}>${await recurse()}</a>`,

  Title: async ({ recurse, el }) => `<title>${await recurse()}</title>`,
  Summary: async ({ recurse, el }) => `<span id="summary" style="${SUMMARY_STYLE}">${await recurse()}</span>`,

  Column: async ({ props, recurse, stack, el, context }): Promise<string> => {

    recurse();

    let expander = '';

    const parent = stack[stack.length - 1];
    const sibs = getKids(parent).filter(x => isOfType(x, 'Column'));
    const colCount = sibs.length || 1;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const pProps = parent.props as { columnVisited: boolean };
    if (!pProps.columnVisited) {
      pProps.columnVisited = true;
      if (sibs.length) {
        sibs[0].props.class = classStr(sibs[0].props.class ?? '', 'first');
        sibs[sibs.length - 1].props.class = classStr(sibs[sibs.length - 1].props.class ?? '', 'last');
      }
    }

    // Check for sizes. If no attribute is provided, default to small-12. Divide evenly for large columns
    const smallSize = el.props.small ?? context.columnCount;
    const largeSize = el.props.large ?? el.props.small ?? Math.trunc(context.columnCount / colCount);

    // If the column contains a nested row, the .expander class should not be used
    if (largeSize === context.columnCount && !props.noExpander) {
      let hasRow = false;
      visit(el, (node) => {
        if (isOfType(node, 'Row')) {
          return hasRow = true;
        }
      });
      if (!hasRow) {
        expander = '\n<th class="expander"></th>';
      }
    }

    const classes: string[] = [`small-${smallSize}`, `large-${largeSize}`, 'columns'];
    if (props.smallOffset) {
      classes.push(`small-offset-${props.smallOffset}`);
    }
    if (props.hideSmall) {
      classes.push('hide-for-small');
    }
    if (props.largeOffset) {
      classes.push(`large-offset-${props.largeOffset}`);
    }
    if (props.hideLarge) {
      classes.push('hide-for-large');
    }

    // Final HTML output
    return `
<th ${propsToStr(el.props, ...classes)}>
  <table>
    <tbody>
      <tr>
        <th>${await recurse()}</th>${expander}
      </tr>
    </tbody>
  </table>
</th>`;
  },

  HLine: async ({ props }) => `
<table ${propsToStr(props, 'h-line')}>
  <tbody>
    <tr><th>&nbsp;</th></tr>
  </tbody>
</table>`,

  Row: async ({ recurse, el }): Promise<string> => `
<table ${propsToStr(el.props, 'row')}>
  <tbody>
    <tr>${await recurse()}</tr>
  </tbody>
<!-- $:&zwj; --></table>`,

  Button: async ({ recurse, el, props, createState }): Promise<string> => {
    const { href, target, ...rest } = props;
    let inner = await recurse();
    let expander = '';

    // If we have the href attribute we can create an anchor for the inner of the button;
    if (href) {
      const linkProps = { href, target };
      if (props.expanded) {
        Object.assign(linkProps, { align: 'center', class: 'float-center' });
      }
      inner = `<a ${propsToStr(linkProps)}>${inner}</a>`;
    }

    // If the button is expanded, it needs a <center> tag around the content
    if (props.expanded) {
      inner = await Html.Center(createState('Center', { children: [inner] }));
      rest.class = classStr(rest.class ?? '', 'expand');
      expander = '\n<td class="expander"></td>';
    }

    // The .button class is always there, along with any others on the <button> element
    return `
<table ${propsToStr(rest, 'button')}>
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
</table>
      ${await Html.Spacer(createState('Spacer', { size: 16 }))}`;
  },

  Container: async ({ recurse, props }): Promise<string> => `
<table align="center" ${propsToStr(props, 'container')}>
  <tbody>
    <tr><td>${await recurse()}</td></tr>
  </tbody>
</table>`,

  BlockGrid: async ({ recurse, props }): Promise<string> => `
<table ${propsToStr(props, 'block-grid', props.up ? `up-${props.up}` : '')}>
  <tbody>
    <tr>${await recurse()}</tr>
  </tbody>
</table>`,

  Menu: async ({ recurse, el, props }): Promise<string> => {
    let hasItem = false;
    visit(el, (child) => {
      if (isOfType(child, 'Item')) {
        return hasItem = true;
      } else if ((child.type === 'td' || child.type === 'th') && child.props.class?.includes('menu-item')) {
        return hasItem = true;
      }
    });

    let inner = await recurse();

    if (!hasItem && inner) {
      inner = `<th class="menu-item">${inner}</th>`;
    }

    return `
<table ${propsToStr(props, 'menu')}>
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
  },

  Item: async ({ recurse, props }): Promise<string> => {
    const { href, target, ...parentAttrs } = props;
    return `
       <th ${propsToStr(parentAttrs, 'menu-item')}>
         <a ${propsToStr({ href, target })}>${await recurse()}</a>
       </th>`;
  },

  Center: async ({ props, recurse, el }): Promise<string> => {
    for (const kid of getKids(el)) {
      Object.assign(kid.props, {
        align: 'center',
        class: classStr(kid.props.class, 'float-center')
      });
    }

    visit(el, child => {
      if (isOfType(child, 'Item')) {
        child.props.class = classStr(child.props.class, 'float-center');
      }
      return;
    });

    return `
<center ${propsToStr(props)}>
  ${await recurse()}
</center>
    `;
  },

  Callout: async ({ recurse, el, props }): Promise<string> => {

    const innerProps: JSXElement['props'] = { class: props.class };
    delete props.class;

    return `
<table ${propsToStr(props, 'callout')}>
  <tbody>
    <tr>
      <th ${propsToStr(innerProps, 'callout-inner')}>
        ${await recurse()}
      </th>
      <th class="expander"></th>
    </tr>
  </tbody>
</table>`;
  },

  Spacer: async ({ props }): Promise<string> => {
    const html: string[] = [];
    const buildSpacer = (size: number | string, extraClass: string = ''): string =>
      `
<table ${propsToStr(props, 'spacer', extraClass)}>
  <tbody>
    <tr>
      <td height="${size}px" style="font-size:${size}px;line-height:${size}px;">&nbsp;</td>
    </tr>
  </tbody>
</table>
      `;

    const sm = props.small ?? undefined;
    const lg = props.large ?? undefined;

    if (sm || lg) {
      if (sm) {
        html.push(buildSpacer(sm, 'hide-for-large'));
      }
      if (lg) {
        html.push(buildSpacer(lg, 'show-for-large'));
      }
    } else {
      html.push(buildSpacer(props.size || 16));
    }

    return html.join('\n');
  },

  Wrapper: async ({ recurse, el }) => `
<table align="center" ${propsToStr(el.props, 'wrapper')}>
  <tbody>
    <tr>
      <td class="wrapper-inner">
        ${await recurse()}
      </td>
    </tr>
  </tbody>
</table>`
};