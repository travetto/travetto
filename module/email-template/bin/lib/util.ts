import * as url from 'url';

import { ConfigUtil } from '@travetto/config/src/internal/util';

import { Inky } from './inky';
import { MarkdownUtil } from './markdown';
import { FileUtil } from './file';
import { StyleUtil } from './style';
import { ImageUtil } from './image';

/**
 * Utilities for templating
 */
export class TemplateUtil {

  /**
   * Create email context via URL and template
   */
  static buildContext(reqUrl: url.URL, content: string) {

    const base: Record<string, any> = {};

    content.replace(/[{]{2}\s*([A-Za-z0-9_.]+)\s*[}]{2}/g, (all, sub) => {
      if (!reqUrl.searchParams.has(sub) || reqUrl.searchParams.get(sub) === '') {
        base[sub] = all;
      } else {
        base[sub] = reqUrl.searchParams.get(sub);
      }
      return '';
    });

    if (reqUrl.searchParams.has('jsonContext')) {
      try {
        Object.assign(base, JSON.parse(reqUrl.searchParams.get('jsonContext')!));
      } catch (e) {
      }
    }

    return ConfigUtil.breakDownKeys(base);
  }

  /**
   * Compile template
   */
  static async compile(tpl: string) {
    // Load wrapper
    tpl = await FileUtil.wrapWithBody(tpl);

    // Resolve mustache partials
    tpl = await FileUtil.resolveNestedTemplates(tpl);

    // Transform inky markup
    let html = Inky.render(tpl);

    // Apply styles
    html = await StyleUtil.applyStyling(html);

    // Inline Images
    html = await ImageUtil.inlineImageSource(html);

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    return { html, text };
  }
}