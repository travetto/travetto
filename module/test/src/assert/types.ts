export const ASSERT_FN_OPERATOR: { [key: string]: string } = {
  equal: '==',
  notEqual: '!=',
  strictEqual: '===',
  notStrictEqual: '!==',
  greaterThanEqual: '>=',
  greaterThan: '>',
  lessThanEqual: '<=',
  lessThan: '<'
};

export const DEEP_EQUALS_MAPPING: { [key: string]: string } = {
  equal: 'deepEqual',
  notEqual: 'notDeepEqual',
  strictEqual: 'deepStrictEqual',
  notStrictEqual: 'notDeepStrictEqual'
};

export const OP_MAPPING: { [key: string]: string } = {
  ok: '{actual} {state} {expected}',
  includes: '{actual} {state} include {expected}',
  test: '{expected} {state} match {actual}',
  throws: '{state} throw {expected}',
  doesNotThrow: '{state} not throw {expected}',
  rejects: '{state} reject {expected}',
  doesNotReject: '{state} not reject {expected}',
  equal: '{actual} {state} equal {expected}',
  notEqual: '{actual} {state} not equal {expected}',
  deepEqual: '{actual} {state} deep equal {expected}',
  notDeepEqual: '{actual} {state} not deep equal {expected}',
  strictEqual: '{actual} {state} strictly equal {expected}',
  notStrictEqual: '{actual} {state} strictly not equal {expected}',
  deepStrictEqual: '{actual} {state} strictly deep equal {expected}',
  notStrictDeepEqual: '{actual} {state} strictly not deep equal {expected}',
  greaterThanEqual: '{actual} {state} be greater than or equal to {expected}',
  greaterThan: '{actual} {state} be greater than {expected}',
  instanceof: '{actual} instance {state} be of type {expected}',
  lessThanEqual: '{actual} {state} be less than or equal to {expected}',
  lessThan: '{actual} {state} be less than {expected}'
};

export const OPTOKEN_ASSERT = {
  EqualsEqualsToken: 'equal',
  ExclamationEqualsToken: 'notEqual',
  EqualsEqualsEqualsToken: 'strictEqual',
  ExclamationEqualsEqualsToken: 'notStrictEqual',
  GreaterThanEqualsToken: 'greaterThanEqual',
  GreaterThanToken: 'greaterThan',
  LessThanEqualsToken: 'lessThanEqual',
  LessThanToken: 'lessThan',
  InstanceOfKeyword: 'instanceof',
};
