// @file-if faker
import * as fakerType from 'faker';

import { Class } from '@travetto/base';

import { CommonRegExp } from '../validate/regexp';
import { FieldConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';
import { BindUtil } from '../bind-util';

// Load faker on demand, as its very heavy in loading
let faker: typeof fakerType = new Proxy(
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  {} as typeof fakerType,
  {
    get: (t, prop, r) => (faker = require('faker'))[prop]
  });

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const between = (fromDays: number, toDays: number): Date =>
  faker.date.between(
    new Date(Date.now() + fromDays * DAY_IN_MS),
    new Date(Date.now() + toDays * DAY_IN_MS)
  );

/**
 * Provide a faker utility for generating content
 */
export class SchemaFakerUtil {

  static #stringToReType: [RegExp, () => string][] = [
    [CommonRegExp.email, (): string => faker.internet.email()],
    [CommonRegExp.url, (): string => faker.internet.url()],
    [CommonRegExp.telephone, (): string => faker.phone.phoneNumber()],
    [CommonRegExp.postalCode, (): string => faker.address.zipCode()]
  ];

  /**
   * Mapping of field types to faker utils
   */
  static #namesToType: {
    string: [RegExp, () => string][];
    date: [RegExp, () => Date][];
  } = {
      string: [
        [/^(image|img).*url$/, (): string => faker.image.imageUrl()],
        [/^url$/, (): string => faker.internet.url()],
        [/^email(addr(ress)?)?$/, (): string => faker.internet.email()],
        [/^(tele)?phone(num|number)?$/, (): string => faker.phone.phoneNumber()],
        [/^((postal|zip)code)|zip$/, (): string => faker.address.zipCode()],
        [/f(irst)?name/, (): string => faker.name.firstName()],
        [/l(ast)?name/, (): string => faker.name.lastName()],
        [/^ip(add(ress)?)?$/, (): string => faker.internet.ip()],
        [/^ip(add(ress)?)?(v?)6$/, (): string => faker.internet.ipv6()],
        [/^username$/, (): string => faker.internet.userName()],
        [/^domain(name)?$/, (): string => faker.internet.domainName()],
        [/^file(path|name)?$/, (): string => faker.system.filePath()],
        [/^street(1)?$/, (): string => faker.address.streetAddress()],
        [/^street2$/, (): string => faker.address.secondaryAddress()],
        [/^county$/, (): string => faker.address.county()],
        [/^country$/, (): string => faker.address.country()],
        [/^state$/, (): string => faker.address.state()],
        [/^lon(gitude)?$/, (): string => faker.address.longitude()],
        [/^lat(itude)?$/, (): string => faker.address.latitude()],
        [/(profile).*(image|img)/, (): string => faker.image.avatar()],
        [/(image|img)/, (): string => faker.image.image()],
        [/^company(name)?$/, (): string => faker.company.companyName()],
        [/(desc|description)$/, (): string => faker.lorem.sentences(10)]
      ],
      date: [
        [/dob|birth/, (): Date => faker.date.past(60)],
        [/creat(e|ion)/, (): Date => between(-200, -100)],
        [/(update|modif(y|ied))/, (): Date => between(-100, -50)]
      ],
    };

  /**
   * Get an array of values
   * @param cfg Field configuration
   */
  static getArrayValue(cfg: FieldConfig): unknown[] {
    const min = cfg.minlength ? cfg.minlength.n : 0;
    const max = cfg.maxlength ? cfg.maxlength.n : 10;
    const size = faker.datatype.number({ min, max });
    const out = [];
    for (let i = 0; i < size; i++) {
      out.push(this.getValue(cfg, true));
    }
    return out;
  }

  /**
   * Get a new number value
   * @param cfg Number config
   */
  static getNumberValue(cfg: FieldConfig): number {
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
  static getDateValue(cfg: FieldConfig): Date {
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
  static getStringValue(cfg: FieldConfig): string {
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
  static getValue(cfg: FieldConfig, subArray = false): unknown {
    if (!subArray && cfg.array) {
      return this.getArrayValue(cfg);
    } else if (cfg.enum) {
      return faker.random.arrayElement(cfg.enum.values);
    } else {

      const typ = cfg.type;

      if (typ === Number) {
        return this.getNumberValue(cfg);
      } else if (typ === String) {
        return this.getStringValue(cfg);
      } else if (typ === Date) {
        return this.getDateValue(cfg);
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
      out[f] = this.getValue(fieldConfig);
    }

    return BindUtil.bindSchema(cls, out, view);
  }
}