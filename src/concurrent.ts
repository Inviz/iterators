import { pubsub } from './pubsub';

/**
 * Type representing any iterable that can yield values
 */
export type Series<T> = AsyncIterable<T> | Iterable<T>;

/**
 * Process an iterable concurrently with limited concurrency
 *
 * @param concurrency Maximum number of concurrent operations
 * @param iteratorFn Function to apply to each item in the iterable
 * @param iterable Source iterable to process
 */
async function* _concurrent<T, R>(
  concurrency: number,
  iteratorFn: (item: T, iterable?: Series<T>) => R,
  iterable: Series<T>
): AsyncGenerator<Awaited<R>> {
  const { publish, consume, producing } = pubsub<R>();

  for await (const item of iterable) {
    publish(iteratorFn(item, iterable));

    if (producing.size >= concurrency) {
      yield await consume();
    }
  }

  while (producing.size) {
    yield await consume();
  }
}

/**
 * Creates a function that processes an iterable concurrently with the specified concurrency limit
 */
export namespace concurrent {
  export function async<T, R>(
    concurrency: number,
    iteratorFn: (item: T, iterable?: Series<T>) => R,
    iterable: Series<T>
  ): AsyncGenerator<Awaited<R>>;
  export function async<T, R>(
    concurrency: number,
    iteratorFn: (item: T, iterable?: Series<T>) => R
  ): (iterable: Series<T>) => AsyncGenerator<Awaited<R>>;
  export function async<T, R>(
    concurrency: number,
    iteratorFn: (item: T, iterable?: Series<T>) => R,
    iterable?: Series<T>
  ): AsyncGenerator<Awaited<R>> | ((iterable: Series<T>) => AsyncGenerator<Awaited<R>>) {
    if (iterable === undefined) {
      return (iter: Series<T>) => _concurrent(concurrency, iteratorFn, iter);
    }
    return _concurrent(concurrency, iteratorFn, iterable);
  }
}
