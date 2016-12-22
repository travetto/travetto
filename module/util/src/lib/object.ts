import * as _ from 'lodash';

export class ObjectUtil {
  static merge = _.merge.bind(_) as typeof _.merge;
  static isPlainObject = _.isPlainObject.bind(_) as typeof _.isPlainObject;

  static values<T>(o: { [key: string]: T }): T[] {
    return Object.keys(o).map(x => o[x]);
  }

  static fromPairs(pairs: [string, any][]): { [key: string]: any } {
    return pairs.reduce((acc: { [key: string]: any }, pair: [string, any]) => {
      acc[pair[0]] = pair[1];
      return acc;
    }, {});
  }

  static toPairs(o: { [key: string]: any }): [string, any][] {
    return Object.keys(o).reduce((acc: [string, any][], k: string) => {
      acc.push([k, o[k]]);
      return acc;
    }, []);
  }
}
