import { ComponentVNode, VNode, PropsOptions, ComponentInstance } from "./type";

let currentInstance: ComponentInstance | null;
export const getCurrentInstance = () => currentInstance;
export function setCurrentInstance(instance: ComponentInstance | null) {
  currentInstance = instance;
};

export function parseClassName(val: string | Record<string, string> | string[]) { 
  if (typeof val === 'string') return val;

  if (Array.isArray(val)) return val.join(' ');

  let className = '';
  for (const key in val) {
    if (val[key]) className += className ? `${val[key]}` : ` ${val[key]}`;
  };
  return className;
};

export function onMounted(cb: () => void) {
  const instance = getCurrentInstance();

  if(!instance) throw Error('请勿在setup函数之外调用生命周期函数！');
  if(!instance.mounted) instance.mounted = [];

  instance.mounted.push(cb);
};

export function parseProps(options: ComponentVNode['props'], propsData: VNode['props']) {
  let props: Record<string, any> = {};
  let attrs: Record<string, any> = {};

  function setProps(option: PropsOptions[string], key: string, propsData: VNode['props']) {
    let value;

    if(propsData) {
      value = propsData;
    } else if(typeof option === 'object' && option.default) {
      const defaultValue = typeof option.default === 'function' ? option.default() : option.default;
      value = defaultValue;
    };

    if(option.type && !((value).constructor === option.type)) console.warn(`props类型不兼容，可能影响组件运行`);
    Reflect.set(props, key, value);
  };

  if(!propsData) {
    for (const key in options) {
      setProps(options[key], key, null);
    }
  } else if(!options) {
    attrs = propsData || {};
  } else {
    for (const key in propsData) {
      if(/^on/.test(key)) {
        Reflect.set(props, key, propsData[key])
      } else if(key in options) {
        setProps(options[key], key, propsData[key]);
      } else {
        Reflect.set(attrs, key, propsData[key]);
      }
    }

    for (const key in options) {
      setProps(options[key], key, props[key]);
    }
  };

  return { props, attrs };
};

export function createEmits(instance: ComponentInstance) {
  return (eventName: string, ...arg: any) => {
    const name = `on${eventName[0].toUpperCase()}${eventName.slice(1)}`;
    instance.props?.[name]?.(...arg);
  };
};