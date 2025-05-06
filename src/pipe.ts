import { AnyIterable } from './types';

type PipeFirst<A> = A extends (...args: any[]) => infer INPUT ? INPUT : A;
type PipeOutput<A, Z> = A extends (...args: infer INPUT) => any ? (...args: INPUT) => Z : Z;

/** Composes functions so that one function is passed as input to the next. If first argument is function, then whole pipe becomes parametrized taking arguments of that first function, which allows composing functions.  */
export function pipe<A>(value: A): PipeOutput<A, A>;
export function pipe<A, B>(value: A, op1: (value: PipeFirst<A>) => B): PipeOutput<A, B>;
export function pipe<A, B, C>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C
): PipeOutput<A, C>;
export function pipe<A, B, C, D>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D
): PipeOutput<A, D>;
export function pipe<A, B, C, D, E>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E
): PipeOutput<A, E>;
export function pipe<A, B, C, D, E, F>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F
): PipeOutput<A, F>;
export function pipe<A, B, C, D, E, F, G>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G
): PipeOutput<A, G>;
export function pipe<A, B, C, D, E, F, G, H>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H
): PipeOutput<A, H>;
export function pipe<A, B, C, D, E, F, G, H, I>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I
): PipeOutput<A, I>;
export function pipe<A, B, C, D, E, F, G, H, I, J>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J
): PipeOutput<A, J>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K
): PipeOutput<A, K>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L
): PipeOutput<A, L>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M
): PipeOutput<A, M>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N
): PipeOutput<A, N>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O
): PipeOutput<A, O>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P
): PipeOutput<A, P>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q
): PipeOutput<A, Q>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R
): PipeOutput<A, R>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S
): PipeOutput<A, S>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S,
  op19: (value: S) => T
): PipeOutput<A, T>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S,
  op19: (value: S) => T,
  op20: (value: T) => U
): PipeOutput<A, U>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S,
  op19: (value: S) => T,
  op20: (value: T) => U,
  op21: (value: U) => V
): PipeOutput<A, V>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S,
  op19: (value: S) => T,
  op20: (value: T) => U,
  op21: (value: U) => V,
  op22: (value: V) => W
): PipeOutput<A, W>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S,
  op19: (value: S) => T,
  op20: (value: T) => U,
  op21: (value: U) => V,
  op22: (value: V) => W,
  op23: (value: W) => X
): PipeOutput<A, X>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S,
  op19: (value: S) => T,
  op20: (value: T) => U,
  op21: (value: U) => V,
  op22: (value: V) => W,
  op23: (value: W) => X,
  op24: (value: X) => Y
): PipeOutput<A, Y>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z>(
  value: A,
  op1: (value: PipeFirst<A>) => B,
  op2: (value: B) => C,
  op3: (value: C) => D,
  op4: (value: D) => E,
  op5: (value: E) => F,
  op6: (value: F) => G,
  op7: (value: G) => H,
  op8: (value: H) => I,
  op9: (value: I) => J,
  op10: (value: J) => K,
  op11: (value: K) => L,
  op12: (value: L) => M,
  op13: (value: M) => N,
  op14: (value: N) => O,
  op15: (value: O) => P,
  op16: (value: P) => Q,
  op17: (value: Q) => R,
  op18: (value: R) => S,
  op19: (value: S) => T,
  op20: (value: T) => U,
  op21: (value: U) => V,
  op22: (value: V) => W,
  op23: (value: W) => X,
  op24: (value: X) => Y,
  op25: (value: Y) => Z
): PipeOutput<A, Z>;

export function pipe(
  value: unknown,
  ...operations: ReadonlyArray<(value: unknown) => unknown>
): unknown {
  if (typeof value == 'function') {
    // @ts-ignore allow spreading
    return (arg: AnyIterable<unknown>) => pipe(arg, value, ...operations);
  } else {
    let result = value;
    for (const operation of operations) {
      result = operation(result);
    }
    return result;
  }
}
