import { ObjectOfStringKey } from 'packages/shared/src/types';
import { createReactive, effect, trigger, track } from './effect';

export * from './effect';

export function ref<T extends string | number | boolean | null>(value: T) { 
  const obj = { value };
  // 该属性用于区分 ref(value) 与 reactive({ value })
  Reflect.defineProperty(obj, '_is_ref', true);

  return obj;
};

export function reactive<T extends ObjectOfStringKey>(raw: T): T { 
  return createReactive(raw, false);
};

export function shallowReactive<T extends ObjectOfStringKey>(raw: T): T { 
  return createReactive(raw, true);
};

export function readonly<T extends ObjectOfStringKey>(raw: T): T { 
  return createReactive(raw, true, true);
};

export function shallowReadonly<T extends ObjectOfStringKey>(raw: T): T { 
  return createReactive(raw, false, true);
};

export function computed(cb: () => any) { 
  let isDirty = true;
  const effectFn = effect(cb, {
    lazy: true,
    scheduler(fn) { 
      fn();
      isDirty = true;
      trigger(obj, 'value');
    }
  });

  let res: any;
  const obj = {
    get value() {
      if (isDirty) {
        res = effectFn();
        isDirty = false;
      }
      track(obj, 'value');
      return res;
    }
  }
  return obj;
};

type WatchSource = () => any | ObjectOfStringKey;
export function watch(
  source: WatchSource | WatchSource[] | any[],
  cb: (value: any, oldValue: any, onInvalidate: (cb: Function) => void) => any
) {
  let handleInvalidate: Function;
  function onInvalidate(cb: Function) { 
    handleInvalidate = cb;
  };

  let oldValue = effect(
    () => traverseWatchSource(source),
    {
      scheduler(fn) {
        handleInvalidate && handleInvalidate();

        const newValue = fn();
        cb(newValue, oldValue, onInvalidate);
        oldValue = newValue;
      }
    }
  );
};

function traverseWatchSource(source: WatchSource | WatchSource[]): WatchSource | WatchSource[] | void {
  if (typeof source === 'function') return source();

  if (Array.isArray(source)) {
    return source.map(item => traverseWatchSource(item)) as WatchSource[];
  };

  if (typeof source === 'object') { 
    for (const key in source as ObjectOfStringKey) { source[key] };
    return source;
  };
};