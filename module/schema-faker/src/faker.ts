import * as faker from 'faker';

import { Class } from '@travetto/base';
import { BindUtil, SchemaRegistry, FieldConfig, CommonRegExp } from '@travetto/schema';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Provide a faker utility for generating content
 */
export class SchemaFaker {

  static #stringToReType = new Map([
    [CommonRegExp.email, faker.internet.email],
    [CommonRegExp.url, faker.internet.url],
    [CommonRegExp.telephone, faker.phone.phoneNumber],
    [CommonRegExp.postalCode, faker.address.zipCode]
  ]);

  /**
   * Mapping of field types to faker utils
   */
  static #namesToType = {
    string: new Map<RegExp, () => string>([
      [/^(image|img).*url$/, faker.image.imageUrl],
      [/^url$/, faker.internet.url],
      [/^email(addr(ress)?)?$/, faker.internet.email],
      [/^(tele)?phone(num|number)?$/, faker.phone.phoneNumber],
      [/^((postal|zip)code)|zip$/, faker.address.zipCode],
      [/f(irst)?name/, faker.name.firstName],
      [/l(ast)?name/, faker.name.lastName],
      [/^ip(add(ress)?)?$/, faker.internet.ip],
      [/^ip(add(ress)?)?(v?)6$/, faker.internet.ipv6],
      [/^username$/, faker.internet.userName],
      [/^domain(name)?$/, faker.internet.domainName],
      [/^file(path|name)?$/, faker.system.filePath],
      [/^street(1)?$/, faker.address.streetAddress],
      [/^street2$/, faker.address.secondaryAddress],
      [/^county$/, faker.address.county],
      [/^country$/, faker.address.country],
      [/^state$/, faker.address.state],
      [/^lon(gitude)?$/, faker.address.longitude],
      [/^lat(itude)?$/, faker.address.latitude],
      [/(profile).*(image|img)/, faker.image.avatar],
      [/(image|img)/, faker.image.image],
      [/^company(name)?$/, faker.company.companyName],
      [/(desc|description)$/, faker.lorem.sentences.bind(null, 10)]
    ]),
    date: new Map([
      [/dob|birth/, faker.date.past.bind(null, 60)],
      [/creat(e|ion)/, this.#between.bind(null, -200, -100)],
      [/(update|modif(y|ied))/, this.#between.bind(null, -100, -50)]
    ]),
  };

  static #between(fromDays: number, toDays: number): Date {
    return faker.date.between(
      new Date(Date.now() + fromDays * DAY_IN_MS),
      new Date(Date.now() + toDays * DAY_IN_MS)
    );
  }

  /**
   * Get an array of values
   * @param cfg Field configuration
   */
  static #array(cfg: FieldConfig): unknown[] {
    const min = cfg.minlength ? cfg.minlength.n : 0;
    const max = cfg.maxlength ? cfg.maxlength.n : 10;
    const size = faker.datatype.number({ min, max });
    const out: unknown[] = [];
    for (let i = 0; i < size; i++) {
      out.push(this.#value(cfg, true));
    }
    return out;
  }

  /**
   * Get a new number value
   * @param cfg Number config
   */
  static #number(cfg: FieldConfig): number {
    let min = cfg.min && typeof cfg.min.n === 'number' ? cfg.min.n : undefined;
    let max = cfg.max && typeof cfg.max.n === 'number' ? cfg.max.n : undefined;
    let precision = cfg.precision;

    const name = cfg.name.toUpperCase();

    if (/(price|amt|amount)$/.test(name)) {
      precision = [13, 2];
    }

    let offset = 1;

    if (precision !== undefined) {
      min = min === undefined ? -((10 ** precision[0]) - 1) : min;
      max = max === undefined ? ((10 ** precision[0]) - 1) : max;
      if (precision[1] !== undefined) {
        offset = (10 ** (precision[1] || 0));
      }
    }

    max = max === undefined ? 1000 : max;
    min = min === undefined ? 0 : min;

    const range = (max - min) * offset;

    const val = Math.trunc(Math.random() * range);

    return (val / offset) + min;
  }

  /**
   * Get a date value
   * @param cfg Field config
   */
  static #date(cfg: FieldConfig): Date {
    const name = cfg.name.toUpperCase();
    const min = cfg.min && typeof cfg.min.n !== 'number' ? cfg.min.n : undefined;
    const max = cfg.max && typeof cfg.max.n !== 'number' ? cfg.max.n : undefined;

    if (min !== undefined || max !== undefined) {
      return faker.date.between(min || new Date(Date.now() - (50 * DAY_IN_MS)), max || new Date());
    } else {
      for (const [re, fn] of this.#namesToType.date) {
        if (re.test(name)) {
          return fn();
        }
      }
      return faker.date.recent(50);
    }
  }

  /**
   * Get a string value
   * @param cfg Field config
   */
  static #string(cfg: FieldConfig): string {
    const name = cfg.name.toLowerCase();

    if (cfg.match) {
      const mre = cfg.match && cfg.match.re;
      for (const [re, fn] of this.#stringToReType) {
        if (mre === re) {
          return fn();
        }
      }
    }

    for (const [re, fn] of this.#namesToType.string) {
      if (re.test(name)) {
        return fn();
      }
    }

    return faker.random.word();
  }

  /**
   * Get a value for a field config
   * @param cfg Field config
   */
  static #value(cfg: FieldConfig, subArray = false): unknown {
    if (!subArray && cfg.array) {
      return this.#array(cfg);
    } else if (cfg.enum) {
      return faker.random.arrayElement(cfg.enum.values);
    } else {

      const typ = cfg.type;

      if (typ === Number) {
        return this.#number(cfg);
      } else if (typ === String) {
        return this.#string(cfg);
      } else if (typ === Date) {
        return this.#date(cfg);
      } else if (typ === Boolean) {
        return faker.datatype.boolean();
      } else if (SchemaRegistry.has(typ)) {
        return this.generate(typ);
      }
    }
  }

  /**
   * Generate a new instance of a class
   * @param cls The class to get an instance of
   * @param view The view to define specifically
   */
  static generate<T>(cls: Class<T>, view?: string): T {
    const cfg = SchemaRegistry.getViewSchema(cls, view);
    const out: Record<string, unknown> = {};

    for (const f of cfg.fields) {
      if (f === 'type' || f === 'id') { // Do not set primary fields
        continue;
      }
      const fieldConfig = cfg.schema[f];
      if (!fieldConfig.required && (Math.random() < .5)) {
        continue;
      }
      out[f] = this.#value(fieldConfig);
    }

    return BindUtil.bindSchema(cls, out, view);
  }
}