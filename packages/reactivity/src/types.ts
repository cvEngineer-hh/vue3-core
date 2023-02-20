import type { ObjectOfStringKey } from '../../shared/src/types';

export interface Effect { 
  (): any,
  options?: EffectOptions,
  deps: EffectSet[],
};

export type EffectSet = Set<Effect>;
export type TargetMap = Map<string | symbol, EffectSet>;
export type Bucket = WeakMap<object, TargetMap>;

export type EffectOptions = {
  lazy?: boolean,
  onTrigger?: (target: object, key: string | symbol) => void,
  scheduler?: (effectFn: Effect) => void,
};

export enum optionType { 
  add = 'add',
  set = 'set',
  del = 'del',
};