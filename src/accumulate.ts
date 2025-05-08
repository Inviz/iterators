import { pubsub } from './lib/pubsub';
import { AnyIterable } from './types';

/**
 * Sequentially accumulates all items from an iterable into an array
 */
async function _accumulate<T>(iterable: AnyIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

/**
 * Concurrently accumulates all items from an iterable into an array
 * @param iterable Source iterable to accumulate
 * @param concurrency Maximum number of concurrent operations
 */
async function _accumulateConcurrently<T>(
  iterable: AnyIterable<T>,
  concurrency: number
): Promise<T[]> {
  const result: T[] = [];
  const {
    publish,
    consume,
    producing,
    wait,
    output: loop,
    onReadComplete: end,
  } = pubsub<T>(concurrency);
  let isDone = false;

  // Process the input stream without blocking the main loop
  (async () => {
    try {
      for await (const item of iterable) {
        if (producing.size >= concurrency) {
          await wait();
        }
        publish(item);
      }
    } finally {
      console.log('accumulate input done', isDone);
      end();
    }
  })();

  for await (const item of loop()) {
    result.push(item);
  }

  return result;
}

/**
 * Processes an iterable with concurrency and yields each item as it completes
 * @param iterable Source iterable to process
 * @param concurrency Maximum number of concurrent operations
 */
async function* _drainConcurrently<T>(
  iterable: AnyIterable<T>,
  concurrency: number
): AsyncGenerator<T> {
  const { publish, consume, producing, wait } = pubsub<T>(concurrency);
  let isDone = false;

  // Process the input stream without blocking the main loop
  (async () => {
    try {
      for await (const item of iterable) {
        if (producing.size >= concurrency) {
          await wait();
        }
        publish(item);
      }
    } finally {
      isDone = true;
    }
  })();

  // Yield items as they become available
  while (!isDone || producing.size) {
    yield await consume();
  }
}

/**
 * Sequentially processes an iterable and yields each item
 */
async function* _drain<T>(iterable: AnyIterable<T>): AsyncGenerator<T> {
  for await (const item of iterable) {
    yield item;
  }
}

/**
 * Accumulates all items from an iterable into an array
 * @param iterable Source iterable to accumulate
 * @param concurrency Optional maximum number of concurrent operations
 */
export function accumulate<T>(iterable: AnyIterable<T>, concurrency?: number): Promise<T[]>;
/**
 * Creates a function that accumulates all items from an iterable into an array
 * @param concurrency Maximum number of concurrent operations
 */
export function accumulate<T>(concurrency: number): (iterable: AnyIterable<T>) => Promise<T[]>;

export function accumulate<T>(
  iterableOrConcurrency: AnyIterable<T> | number,
  concurrency?: number
): Promise<T[]> | ((iterable: AnyIterable<T>) => Promise<T[]>) {
  if (typeof iterableOrConcurrency === 'number') {
    return (iterable: AnyIterable<T>) => accumulate(iterable, iterableOrConcurrency);
  } else if (concurrency && concurrency > 1) {
    return _accumulateConcurrently(iterableOrConcurrency, concurrency);
  } else {
    return _accumulate(iterableOrConcurrency);
  }
}

/**
 * Processes an iterable with optional concurrency and yields each item as it completes
 * @param iterable Source iterable to process
 * @param concurrency Optional maximum number of concurrent operations
 */
export function drain<T>(iterable: AnyIterable<T>, concurrency?: number): AsyncGenerator<T>;
/**
 * Creates a function that processes an iterable with concurrency and yields each item
 * @param concurrency Maximum number of concurrent operations
 */
export function drain<T>(concurrency: number): (iterable: AnyIterable<T>) => AsyncGenerator<T>;

export function drain<T>(
  iterableOrConcurrency: AnyIterable<T> | number,
  concurrency?: number
): AsyncGenerator<T> | ((iterable: AnyIterable<T>) => AsyncGenerator<T>) {
  if (typeof iterableOrConcurrency === 'number') {
    return (iterable: AnyIterable<T>) => drain(iterable, iterableOrConcurrency);
  } else if (concurrency && concurrency > 1) {
    return _drainConcurrently(iterableOrConcurrency, concurrency);
  } else {
    return _drain(iterableOrConcurrency);
  }
}
