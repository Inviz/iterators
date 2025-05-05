/**
 * Functions for transforming elements of an iterable using a mapper function
 */

import { pubsub } from './lib/pubsub';
import { AnyIterable } from './types';
/**
 * Internal implementation of async map
 *
 * @param input Source iterable to map over
 * @param iteratorFn Function to transform each item
 */
async function* _map<T, R>(
  input: AnyIterable<T>,
  iteratorFn: (item: T, iterable?: AnyIterable<T>) => R
): AsyncGenerator<Awaited<R>> {
  for await (const value of input) {
    yield await iteratorFn(value, input);
  }
}

/**
 * Process an iterable with limited concurrency
 *
 * @param input Source iterable to map over
 * @param iteratorFn Function to apply to each item in the iterable
 * @param concurrency Maximum number of map operations
 */
async function* _mapConcurrently<T, R>(
  input: AnyIterable<T>,
  iteratorFn: MapFunction<T, R>,
  concurrency: number
): AsyncGenerator<Awaited<R>> {
  const { publish, consume, producing } = pubsub<R>();

  for await (const item of input) {
    publish(iteratorFn(item, input));

    if (producing.size >= concurrency) {
      yield await consume();
    }
  }

  while (producing.size) {
    yield await consume();
  }
}

/**
 * Creates a function that transforms elements of an iterable
 * If concurrency is provided, processes the iterable concurrently
 */
export type MapFunction<T, R> = (item: T, iterable?: AnyIterable<T>) => R;
export function map<T, R>(
  input: AnyIterable<T>,
  transform: MapFunction<T, R>,
  concurrency?: number
): AsyncGenerator<Awaited<R>>;
export function map<T, R>(
  transform: MapFunction<T, R>,
  concurrency?: number
): (input: AnyIterable<T>) => AsyncGenerator<Awaited<R>>;

export function map<T, R>(
  input: AnyIterable<T> | MapFunction<T, R>,
  transform?: any,
  concurrency?: any
) {
  if (typeof input === 'function') {
    return (_input: AnyIterable<T>) => map(_input, input, transform);
  } else if (concurrency > 1) {
    return _mapConcurrently(input, transform, concurrency);
  } else {
    return _map(input, transform);
  }
}
