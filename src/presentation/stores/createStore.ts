import { create as runtimeCreate } from "zustand";

type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
) => void;

type GetState<T> = () => T;

type BoundStore<T> = {
  (): T;
  <U>(selector: (state: T) => U): U;
};

export const createStore = runtimeCreate as unknown as <T>(
  initializer: (set: SetState<T>, get: GetState<T>) => T,
) => BoundStore<T>;
