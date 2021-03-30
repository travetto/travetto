import * as parse5 from 'parse5';
import * as htmlEntities from 'html-entities';

import { HtmlUtil, Parse5Adapter } from './html';

const LI_TOKEN = '⇜⇟⇝';

/**
 * Markdown processing
 */
export class MarkdownUtil {

  /**
   * Get raw text from DOM node
   */
  private static getRawText(node: parse5.Node) {
    let txt: string;
    if (Parse5Adapter.isTextNode(node)) {
      txt = Parse5Adapter.getTextNodeContent(node);
    } else {
      txt = HtmlUtil.getInnerText(node);
    }
    return txt;
  }

  /**
   * Convert to raw text
   */
  private static getText(node: parse5.Node) {
    return this.getRawText(node).replace(/ +/g, ' ')
      .replace(/ +[\n]/g, '\n')
      .replace(/^[\n\s]+/, ' ')
      .replace(/[\n\s]+$/, ' ');
  }

  /**
   * Get attribute as a number
   */
  private static getIntAttr(attrs: Record<string, string>, name: string, def?: number): number {
    return (name in attrs ? parseInt(attrs[name], 10) : def) ?? 0;
  }

  /**
   * Get attribute as string
   */
  private static getAttr(attrs: Record<string, string>, name: string) {
    return (attrs[name] ?? '').trim();
  }

  /**
   * Convert HTML to a markdown blob
   */
  static async htmlToMarkdown(html: string) {

    // Cleanup html from templating
    let simple = html.replace(/&#xA0;/g, ' '); // Remove entities

    // Decode all encoded pieces
    simple = htmlEntities.decode(simple);

    const output: string[] = [];

    const doc = parse5.parse(simple);
    const listMode: (string | number)[] = [];

    HtmlUtil.visit(doc, (node, descend) => {
      const attrs = HtmlUtil.getAttrMap(node);
      if (Parse5Adapter.isTextNode(node)) {
        const text = this.getText(node);
        if (!/^[ \n]+$/.test(text)) {
          output.push(text);
        }
        return;
      }
      const t = Parse5Adapter.getTagName(node);
      if (!t) {
        return;
      }
      const tagName = t.toLowerCase();
      switch (tagName) {
        case 'row':
        case 'div':
        case 'columns':
        case 'container':
        case 'callout':
          descend();
          output.push('\n');
          break;
        case 'spacer':
        case 'br':
          output.push('\n'.repeat(Math.trunc(this.getIntAttr(attrs, 'size', 16) / 16)));
          break;
        case 'button':
        case 'a':
          output.push(`[${this.getAttr(attrs, 'title') || this.getText(node).trim()}](${this.getAttr(attrs, 'href')})`);
          break;
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          output.push('\n', '#'.repeat(parseInt(tagName.substring(1), 10)), ' ');
          descend();
          output.push('\n');
          break;
        case 'ol':
        case 'menu':
        case 'ul':
          if (!listMode.length) {
            output.push('\n');
          }
          listMode.push(tagName === 'ol' ? 1 : '*');
          descend();
          listMode.pop();
          if (!listMode.length) {
            output.push('\n');
          }
          break;
        case 'item':
        case 'li': {
          output.push('\n', LI_TOKEN, '  '.repeat(listMode.length));
          const top = listMode[listMode.length - 1];
          if (typeof top === 'number') {
            output.push(`${top}. `);
            (listMode[listMode.length - 1] as number)++;
          } else {
            output.push(top, ' ');
          }
          descend();
          break;
        }
        case 'p':
          output.push('\n');
          descend();
          output.push('\n');
          break;
        case 'h-line':
        case 'hr':
          output.push('\n');
          output.push('\n---------------\n');
          output.push('\n');
          break;
        case 'b':
        case 'strong':
          output.push('**');
          descend();
          output.push('**');
          break;
        case 'i':
        case 'em':
          output.push('__');
          descend();
          output.push('__');
          break;
        case 'img':
          output.push(`![${this.getAttr(attrs, 'alt')}](${this.getAttr(attrs, 'src')} ${this.getAttr(attrs, 'title')})`);
          break;
        case 'pre':
        case 'code':
          output.push('\n', '```', this.getRawText(node), '```', '\n');
          break;
        case 'script':
        case 'style':
        case 'head':
          // Drop entirely
          break;
        case 'title': case 'summary': break;
        default:
          descend();
      }
    });

    //  return finalText;
    return output
      .reduce((all, v) => {
        if (!(all[all.length - 1] === '\n' && all[all.length - 2] === '\n' && v === '\n')) {
          all.push(v);
        }
        return all;
      }, [] as string[])
      .join('')
      .trim()
      .replace(/ +[\n]/msg, '\n')
      .replace(/[\n][ ]+/msg, '\n')
      .replace(new RegExp(LI_TOKEN, 'g'), '');
  }
}