export * from './types'
export * from './validator';
export * from './registry';

// Patch promise
require('mongoose').Promise = global.Promise;