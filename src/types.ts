export type MaybePromise<T> = T | Promise<T>;

/**
 * Type representing any iterable that can yield values
 */
export type AnyIterable<T> = AsyncGenerator<T> | Iterable<T>;

export type * from './index';
