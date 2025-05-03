/**
 * Re-exports of rotery's async functions without the nested namespace structure
 *
 * This simplifies importing and using rotery's async functions.
 * Instead of `Rt.map.async`, you can use `map` directly.
 */
import * as Rt from 'rotery';

// Re-export types
export type { MaybePromise } from 'rotery';
export type { Series } from './concurrent';

// Mappers
export const map = Rt.map.async;
export const flatMap = Rt.flatMap.async;

// Filters
export const filter = Rt.filter.async;
export const unique = Rt.unique.async;
export const uniqueBy = Rt.uniqueBy.async;
export const uniqueWith = Rt.uniqueWith.async;

// Reducers
export const find = Rt.find.async;
export const every = Rt.every.async;
export const some = Rt.some.async;
export const reduce = Rt.reduce.async;

// Side Effectors
export const forEach = Rt.forEach.async;
export const peek = Rt.peek.async;

// Splicers
export const take = Rt.take.async;
export const drop = Rt.drop.async;
export const concat = Rt.concat.async;

// Controls
export const chunk = Rt.chunk.async;
export const flatten = Rt.flatten.async;
export const accumulate = Rt.accumulate.async;
export const buffer = Rt.buffer;
export const serialize = Rt.serialize.async;

// Groups
export const difference = Rt.difference.async;
export const differenceBy = Rt.differenceBy.async;
export const differenceWith = Rt.differenceWith.async;
export const intersection = Rt.intersection.async;
export const intersectionBy = Rt.intersectionBy.async;
export const intersectionWith = Rt.intersectionWith.async;

// Composition utilities
export const { pipe, compose } = Rt;
