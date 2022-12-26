interface Effect {
  (): any,
  deps: EffectSet[],
};
type EffectSet = Set<Effect>;
type TargetMap = Map<string | symbol, EffectSet>;
type EffectMap = WeakMap<object, TargetMap>;

type objectOfStringKey = { [key in string]: any };

const effectMap: EffectMap = new WeakMap();
function getEffectSet<T extends objectOfStringKey>(target: T, key: keyof T | symbol): EffectSet { 
  let targetMap = effectMap.get(target);
  if (!targetMap) { 
    effectMap.set(target, (targetMap = new Map()));
  }

  let effectSet = targetMap.get(key as string);
  if (!effectSet) { 
    targetMap.set(key as string, (effectSet = new Set()));
  }

  return effectSet;
}

// 收集依赖的同时
function track<T extends objectOfStringKey>(target: T, key: keyof T | symbol): void { 
  if (!activeEffect) return;
  const effectSet = getEffectSet(target, key);

  effectSet.add(activeEffect);
  activeEffect.deps.push(effectSet);
};

function trigger<T extends objectOfStringKey>(target: T, key: keyof T | symbol): void { 
  const targetMap = effectMap.get(target);
  if (!targetMap) return;
  const effectSet = targetMap.get(key as string);
  if (!effectSet) return;

  const newEffectSet = new Set(effectSet);

  newEffectSet.forEach(effect => { 
    effect !== activeEffect && effect();
  });
}

export function reactive<T extends {[key in string]: any}>(raw: T): T { 
  return new Proxy(raw, {
    get(target, key, receiver) {
      track<T>(target, key);
      
      return Reflect.get(target, key, receiver);
    },

    set(target, key, value, receiver) {
      const res = Reflect.set(target, key, value);
      trigger<T>(target, key);

      return res;
    }
  }) as T;
}

function clearOverdueEffect(effect: Effect) { 
  effect.deps.forEach(effectSet => {
    effectSet.clear();
  });

  effect.deps.length = 0;
}

let activeEffect: Effect;
const activeEffectQueue: Effect[] = [];
export function effect(cb: Function) {
  const effectFn: Effect = () => {
    clearOverdueEffect(effectFn);
    activeEffect = effectFn;
    // 处理 watchEffect嵌套时。activeEffect指向丢失的问题
    // 收集依赖之前将副作用函数压入栈，依赖收集完后将副作用函数从栈中弹出
    activeEffectQueue.push(effectFn);
    cb();
    activeEffectQueue.pop();
    activeEffect = activeEffectQueue[activeEffectQueue.length - 1];
  };
  effectFn.deps = [];
  
  effectFn();
}