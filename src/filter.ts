/**
 * Functions for filtering elements of an iterable that match a predicate
 */

import { pubsub } from './lib/pubsub';
import { AnyIterable, MaybePromise } from './types';

/**
 * Internal implementation of async filter
 *
 * @param input Source iterable to filter
 * @param test Predicate function to test each item - can return boolean to filter, null to exclude, or any other value to transform
 */
type FilterFunction<T, R = T> = (value: Awaited<T> | T) => MaybePromise<boolean | null | R>;

async function* _filter<T, R = T>(
  input: AnyIterable<T>,
  test: FilterFunction<T, R>
): AsyncGenerator<T | R> {
  for await (const value of input) {
    const result = await test(value);
    if (result === false || result === null) continue;
    if (result === true) yield value;
    else yield result as R;
  }
}

/**
 * Process an iterable with limited concurrency
 *
 * @param input Source iterable to filter
 * @param test Function to test each item
 * @param concurrency Maximum number of filter operations
 */
function _filterConcurrently<T, R>(
  iterator: AnyIterable<T>,
  test: FilterFunction<T, R>,
  concurrency: number = 1
): AsyncGenerator<T | R> {
  const { output, input } = pubsub<T | R, T>(concurrency);

  return output({
    onStart: () => {
      return input(iterator, async value => {
        const result = await test(value);
        if (result === false || result === null) return;
        if (result === true) return value;
        else return result as R;
      });
    },
  });
}

/**
 * Creates a function that filters elements of an iterable that match a predicate.
 * If the predicate returns boolean true, the original value is yielded.
 * If the predicate returns boolean false or null, the value is excluded.
 * If the predicate returns any other value, that value is yielded instead.
 */
export function filter<T, R = T>(
  input: AnyIterable<T>,
  test: FilterFunction<T, R>,
  concurrency?: number
): AsyncGenerator<T | R>;
export function filter<T, R = T>(
  test: FilterFunction<T, R>,
  concurrency?: number
): (input: AnyIterable<T>) => AsyncGenerator<R extends boolean | null ? T : R>;
export function filter<T, R>(
  input: AnyIterable<T> | FilterFunction<T, R>,
  test?: any,
  concurrency?: number
) {
  // If the first argument is a function, assume it's the test function and return a curried function
  if (typeof input === 'function') {
    return (_input: AnyIterable<T>) => filter(_input, input, test);
  }

  // Otherwise, first argument is the input Series and second is the test function
  return _filterConcurrently(input, test, concurrency);
}

export function identity<T>(item: T): T {
  return item;
}
