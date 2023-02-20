import { queueJob } from '@vue/shared';
import { reactive } from '.';
import type { ObjectOfStringKey } from '../../shared/src/types';
import { Effect, Bucket, EffectOptions, optionType } from './types';

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

// 这个key用来收集迭代器产生的副作用
const ITERATE_KEY = Symbol();
export function createReactive<T extends ObjectOfStringKey>(raw: T, isShallow: boolean, isReadonly: boolean = false): T { 
  return new Proxy(raw, {
    get(target, key, receiver) {
      if (isShallow && key === 'raw') return target;
      // 只读属性不会被修改，不需要收集
      !isReadonly && track(target, key);
      // 当被代理对象中有一个访问器属性 get value() { return this.name }
      //  此时的this指向原始对象，无法触发set拦截函数
      // reflect接受第三个参数，作为访问器属性中的this
      const res = Reflect.get(target, key, receiver);
      if (!isShallow && typeof res === 'object') { 
        return reactive(res);
      }
      return res;
    },

    set(target, key, value, receiver) {
      if (isReadonly) { 
        console.warn('只读属性不可修改！');
        return true;
      };

      const type = Reflect.has(target, key) ? optionType.set : optionType.add;
      if (Reflect.get(target, key) === value) return true;

      // 这里需要先赋值，以便后续执行副作用函数时能获取到被正确更新的值
      const res = Reflect.set(target, key, value, receiver);
      trigger(target, key, type);
      return res;
    },

    deleteProperty(target, key) { 
      if (isReadonly) { 
        console.warn('只读属性不可修改！');
        return true;
      };

      const has1 = Reflect.has(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (res && has1) { 
        trigger(target, key, optionType.del);
      };
      return res;
    },

    // in 操作符会触发 has 拦截函数
    has(target, key) { 
      if (typeof key !== 'symbol') { 
        track(target, key);
      };
      return Reflect.has(target, key);
    },

    // forin等迭代器会触发ownKeys拦截函数
    ownKeys(target) { 
      track(target, ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
};

const bucket: Bucket = new WeakMap();
export function track(target: ObjectOfStringKey, key: string | symbol) { 
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

export function trigger(target: object, key: string | symbol, type: optionType = optionType.add) { 
  const targetMap = bucket.get(target);
  if (!targetMap) return;

  const newEffectSet = new Set<Effect>(targetMap.get(key));
  // 因为属性的 添加 和 删除 都会影响迭代器的结果，所以此处加入迭代器收集的依赖
  if (type === optionType.add || type === optionType.del) { 
    targetMap.get(ITERATE_KEY)?.forEach(iterateEffect => newEffectSet.add(iterateEffect));
  };

  newEffectSet.forEach(effectFn => { 
    // 当在副作用函数中同时读取、修改自身时，会导致在get拦截函数还未执行完毕时再调用set函数，如此无限循环
    // 这行代码会阻止这一过程
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
