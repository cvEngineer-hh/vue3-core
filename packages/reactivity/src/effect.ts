import { queueJob } from '@vue/shared';
import { reactive } from '.';
import type { ObjectOfStringKey } from '../../shared/src/types';
import type { Effect, Bucket, EffectOptions } from './types';

let activeEffect: Effect | undefined;
const activeEffectQueue: Effect[] = [];

function cleanupEffectOfOverdue(effectFn: Effect) { 
  effectFn.deps.forEach(effectSet => effectSet.delete(effectFn));

  effectFn.deps.length = 0;
};

export function effect(cb: () => any | void, options?: EffectOptions) { 
  // 在执行副作用函数时，可能需要调用一些钩子函数（options中的），为了防止污染原本的函数，这里需要额外包裹一层
  const EffectFn: Effect = () => {
    cleanupEffectOfOverdue(EffectFn);
    activeEffect = EffectFn;
    // 处理 effect 嵌套时。activeEffect指向丢失的问题
    // 收集依赖之前将副作用函数压入栈，依赖收集完后将副作用函数从栈中弹出
    activeEffectQueue.push(EffectFn);
    let res = cb();
    activeEffectQueue.pop();
    activeEffect = activeEffectQueue[activeEffectQueue.length - 1];
    return res;
  };
  EffectFn.options = options;
  EffectFn.deps = [];
  
  if (options?.lazy) { 
    return EffectFn;
  }
  return EffectFn();
};



export function createReactive<T extends ObjectOfStringKey>(raw: T, isShallow: boolean): T { 
  return new Proxy(raw, {
    get(target, key) {
      // 暂时不考虑属性为 symbol 的情况
      if (typeof key === 'symbol') return;
      if (isShallow && key === 'raw') return target;

      track(target, key);
      const res = Reflect.get(target, key);
      if (isShallow && typeof res === 'object') { 
        return reactive(res);
      }
      return res;
    },

    set(target, key, value) {
      // 暂时不考虑属性为 symbol 的情况
      if (typeof key === 'symbol') return false;
      if (Reflect.get(target, key) === value) return true;

      // 这里需要先赋值，以便后续执行副作用函数时能获取到被正确更新的值
      const res = Reflect.set(target, key, value);
      trigger(target, key);
      return res;
    },
  });
};

const bucket: Bucket = new WeakMap();
export function track(target: ObjectOfStringKey, key: string) { 
  if (!activeEffect) return;

  let targetMap = bucket.get(target);
  if (!targetMap) { 
    bucket.set(target, (targetMap = new Map()));
  }

  let effectSet = targetMap.get(key);
  if (!effectSet) { 
    targetMap.set(key, (effectSet = new Set()));
  }

  effectSet.add(activeEffect);
  activeEffect.deps.push(effectSet);
};

export function trigger(target: ObjectOfStringKey, key: string) { 
  const targetMap = bucket.get(target);
  if (!targetMap) return;

  const newEffectSet = new Set<Effect>(targetMap.get(key));
  newEffectSet.forEach(effectFn => { 
    // 当在副作用函数中同时读取、修改自身，会引起无限递归
    // 原因在于：触发 set 函数时会循环检查依赖项并执行依赖，而依赖中的调用又会触发 get 收集依赖，在
    if (activeEffect === effectFn) return;

    const executeEffect = () => {
      effectFn?.options?.onTrigger?.(target, key);
      return effectFn();
    };

    // 将函数执行权抛出
    if (Reflect.has(effectFn?.options || {}, 'scheduler')) {
      effectFn.options?.scheduler?.(executeEffect as Effect);
    } else { 
      queueJob(executeEffect);
    }
  });
};
