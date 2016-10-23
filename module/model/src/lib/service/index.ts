export * from './model'
export * from './validator';

//Patch promise
require('mongoose').Promise = global.Promise;