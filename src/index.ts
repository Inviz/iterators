/**
 * Re-exports of functions without the nested namespace structure
 *
 * This simplifies importing and using async functions.
 * Instead of `namespace.async`, you can use the function directly.
 */
import * as Rt from 'rotery';
import { concurrent as concurrentNs } from './concurrent';
import { race as raceNs } from './race';
export * from './pubsub';

// Re-export types
export type { MaybePromise } from 'rotery';
export type { Series } from './concurrent';

// Re-export concurrent and race directly
export const concurrent = concurrentNs.async;
export const race = raceNs.async;

// Mappers from rotery
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
