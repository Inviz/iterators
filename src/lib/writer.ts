import { AnyIterable } from '../types';
import { pubsub } from './pubsub';

/**
 * Turns an async pipe into a writable stream by enabling "forcing" values through it.
 *
 * The writer function takes a pipe (function that returns iterator chain) and enables
 * pushing values through it while controlling the flow. This is done by providing both
 * input and output mechanisms to that pipe.
 *
 * This creates a backpressure-aware stream where:
 * - Values are pushed at the front of the queue
 * - Processing happens through the pipe's transformation chain
 * - Iterator advancement is controlled at the back
 *
 * @param callback - A function that processes an iterable and returns another iterable
 * @param concurrency - Optional concurrency limit for the underlying pubsub queue
 * @returns An object with iterator, generator, and push function to control the stream
 */
export function writer<T, R>(
  callback: (iterator: AnyIterable<T>) => AnyIterable<R>,
  concurrency?: number
) {
  // create queue for incoming values
  const { publish, consume, producing } = pubsub<T>(concurrency);

  let isDone = false;

  // initialize pipe to read from the queue
  const stream = (async function* generator() {
    while (!isDone || producing.size > 0) {
      console.log('generator going again');
      const value = await consume();
      console.log('generator', value);
      yield value;
      console.log('generatorrrrr', value);
    }
  })();

  const iterator = callback(stream);

  return {
    [Symbol.asyncIterator]: () => toAsyncIterable(iterator),
    publish,
    end: () => {
      isDone = true;
      if (producing.size == 0) {
        stream.return();
      }
    },
    write: async (value: T) => {
      // put value into queue
      await publish(value);
      if ('next' in iterator) {
        console.log('call next');
        const next = iterator.next();
        console.log('await next');
        const n = await next;
        console.log('got next', n);
        // advance pipe iterator by one
        return n.value;
      }
    },
  };
}

export function toAsyncIterable<T>(iterator: AnyIterable<T>): AsyncIterator<T> {
  if (Symbol.asyncIterator in iterator) {
    return iterator[Symbol.asyncIterator]();
  }
  return (async function* () {
    for await (const value of iterator) {
      yield value;
    }
  })();
}
