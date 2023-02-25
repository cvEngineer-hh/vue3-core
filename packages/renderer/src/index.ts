import { effect, reactive } from "../../reactivity/src";
import { createEmits, parseClassName, parseProps, setCurrentInstance } from "./common";
import { ComponentVNode, VNode } from "./type";

const defaultRendererOptions = {
  updateProps(el: Required<VNode>['el'], key: string, val: any) {
    if (key === 'className') el.className = parseClassName(val);
    
    if(key === 'style') {
      for (const key in val) {
        Reflect.set(el.style, key, val[key]);
      }
      return;
    };

    if (/^on.*/.test(key)) {
      // 将事件处理函数保存在 value 属性中，这样在事件更新时只需要更新 value 值，无需重新注册、移除事件
      // 触发事件时只需要调用 value 属性即可
      const invokers = el._vei || (el._vei = {});
      const eventName = key.replace('on', '').toLowerCase();
      if (!(eventName in invokers)) {
        invokers[eventName] = { value: val };
        el.addEventListener(eventName, e => { 
          const invokerValue = invokers[eventName].value;
          if (Array.isArray(invokerValue)) { 
            invokerValue.forEach(fn => fn(e));
          } else {
            invokerValue(e);
          }
        });
      } else { 
        invokers[eventName].value = val;
      }
      return;
    };

    Reflect.set(el, key, val);
  },

  unmount(dom: Element) {
    dom.parentElement?.removeChild(dom);
  },

  setContentText(el: HTMLElement, text: string) {
    el.innerText = text;
  },

  insert(parent: HTMLElement, children: HTMLElement, anchor?: HTMLElement | null) {
    parent.insertBefore(children, anchor || null);
  }
};

enum NodeType {
  TEXT = 'TEXT',
  ELEMENT = 'ELEMENT',
  COMPONENT = 'COMPONENT',
};
function getNodeType(vnode: VNode) {
  if(typeof vnode.type === 'string') return NodeType.ELEMENT;

  if(typeof vnode.type === 'object') return NodeType.COMPONENT;
};

export function createRenderer(options = defaultRendererOptions) {

  const {
    updateProps,
    unmount,
    setContentText,
    insert,
  } = options;

  let oldVNode: VNode;
  function render(VNode: VNode, container: HTMLElement | null = document.querySelector('#app')) {
    if (!container) throw Error('container of null!');

    if(VNode) {
      patch(VNode, oldVNode, container);
    } else if(oldVNode) {
      oldVNode.el && unmount(oldVNode.el);
    }

    oldVNode = VNode;
  };

  function patch(n1: VNode, n2: VNode | null, container: HTMLElement, anchor: HTMLElement | null = null) {
    const patchFn = {
      [NodeType.ELEMENT]: patchElement,
      [NodeType.COMPONENT]: patchComponent,
    };
    
    const mountFn = {
      [NodeType.ELEMENT]: mountElement,
      [NodeType.COMPONENT]: mountComponent,
    };

    const newNodeType = getNodeType(n1);
    
    if(n2) {
      newNodeType && patchFn[newNodeType]?.(n1, n2, container, anchor);
    } else {
      newNodeType && mountFn[newNodeType]?.(n1, container, anchor);
    };
  };

  function patchElement(n1: VNode, n2: VNode, container: HTMLElement, anchor: HTMLElement | null = null) {
    const el = (n1.el = n2.el);
    if (!el) throw Error('渲染错误：dom在渲染前被销毁');

    patchProps(n1.props, n2.props, el);
    patchChildren(n1, n2, el);
  };

  function patchProps(newProps: VNode['props'], oldProps: VNode['props'], el: HTMLElement) {
    if (newProps && oldProps) {
      for (const key in newProps) {
        updateProps(el, key, newProps[key]);
      }

      for (const key in oldProps) {
        if(!Reflect.has(oldProps, key)) {
          updateProps(el, key, null);
        }
      }
    } else if(!newProps) {
      for (const key in oldProps) {
        updateProps(el, key, null);
      }
    } else if(!oldProps) {
      for (const key in newProps) {
        updateProps(el, key, newProps[key]);
      }
    }
  };

  function patchChildren(n1: VNode, n2: VNode, el: HTMLElement) { 
    function emptyChildren(vnode: VNode) {
      if (!vnode.children) return;
      if (typeof vnode.children === 'string') {
        vnode.el && setContentText(vnode.el, '');
      } else { 
        vnode.children.forEach(item => item.el && unmount(item.el))
      }
    };

    function mountChildren(vnode: VNode) { 
      if (!vnode.children) return;
      typeof vnode.children === 'string'
        ? setContentText(el, vnode.children)
        : vnode.children.forEach(node => patch(node, null, el));
    };

    if (!n1.children) return emptyChildren(n2);
    if (!n2.children) return mountChildren(n1);

    if (typeof n1.children === 'string') { 
      emptyChildren(n2);
      mountChildren(n1);
      return;
    } else if (typeof n2.children === 'string') { 
      emptyChildren(n2);
      mountChildren(n1);
      return;
    };
    
    let newStartIndex = 0;
    let oldStartIndex = 0;
    let newEndIndex = n1.children.length - 1;
    let oldEndIndex = n2.children.length - 1;

    let newStartNode = n1.children[newStartIndex];
    let oldStartNode = n2.children[oldStartIndex];
    let newEndNode = n1.children[newEndIndex];
    let oldEndNode = n2.children[oldEndIndex];
    while (newStartIndex <= newEndIndex || oldStartIndex <= oldEndIndex) {
      if (!oldStartNode.el) { 
        oldStartNode = n2.children[++oldStartIndex];
        continue;
      };
      if (!oldEndNode.el) { 
        oldEndNode = n2.children[--oldEndIndex];
        continue;
      };

      if (newStartNode.key === oldStartNode.key) {
        patch(newStartNode, oldStartNode, el);
        newStartNode = n1.children[++newStartIndex];
        oldStartNode = n2.children[++oldStartIndex];
        continue;
      };

      if (newEndNode.key === oldEndNode.key) { 
        patch(newEndNode, oldEndNode, el);
        newEndNode = n1.children[--newEndIndex];
        oldEndNode = n2.children[--oldEndIndex];
        continue;
      };

      if (newStartNode.key === oldEndNode.key) { 
        patch(newStartNode, oldEndNode, el);
        oldEndNode.el && insert(el, oldEndNode.el, oldStartNode.el);
        newStartNode = n1.children[++newStartIndex];
        oldEndNode = n2.children[--oldEndIndex];
        continue;
      };

      if (newEndNode.key === oldStartNode.key) { 
        patch(newEndNode, oldStartNode, el);
        oldStartNode.el && insert(el, oldStartNode.el, oldEndNode?.el?.nextElementSibling as HTMLElement);
        newEndNode = n1.children[--newEndIndex];
        oldStartNode = n2.children[++oldStartIndex];
        continue;
      };

      // 如果所有情况都没有命中，则向所有的旧节点中查询
      const reusableOfIndex = n2.children.findIndex(node => node.key === newStartNode.key);
    
      if (reusableOfIndex === -1) {
        patch(newStartNode, null, el);
      } else { 
        const node = n2.children[reusableOfIndex];
        patch(newStartNode, node, el);
        node.el && insert(el, node.el, oldStartNode.el);
        // 将 el 置空代表该节点已被复用
        node.el = undefined;
      };
      newStartNode = n1.children[++newStartIndex];
    };
  };

  function mountElement(node: VNode | VNode['children'], container: HTMLElement, anchor: HTMLElement | null = null) {
    if(Array.isArray(node)) {
      node.forEach(children => mountElement(children, container, anchor));
    } else if(typeof node === 'object') {

      node.el = document.createElement(node.type as keyof HTMLElementTagNameMap);
      patchProps(node.props, null, node.el);
      insert(container, node.el, anchor);
      mountElement(node.children, node.el, anchor);

    } else if(typeof node === 'string') {
      setContentText(container, node);
    }
  };

  function mountComponent(node: VNode, container: HTMLElement, anchor: HTMLElement | null = null) {
    const component = node.type as ComponentVNode;

    let { render } = component;
    const { 
      props: propsOptions, data, setup, 
      beforeCreate, created, beforeMount, 
      mounted, beforeUpdate,  updated, 
    } = component;

    beforeCreate && beforeCreate();
    const { props, attrs } = parseProps(propsOptions, node.props);

    const instance: typeof component.instance  = {
      attrs,// 需要注意 attrs 不是响应式的
      props: reactive(props),
      state: data ? reactive(data()) : null,
      subTre: null,
    };

    component.instance = instance;
    const emits = createEmits(instance);
    
    // 兼容setup写法
    if(setup) {
      setCurrentInstance(instance);
      const setupRes = setup(instance.props, { attrs: instance.attrs, emits }); 
      setCurrentInstance(null);

      if(typeof setupRes === 'function') {
        render = setupRes as () => VNode;
      } else if(setupRes) {
        instance.state = reactive(setupRes);
      }
    };
    
    const renderContext = new Proxy(instance, {
      get(target, key) {
        if(typeof key === 'symbol') return false;
        const { state, props } = target;

        if(state && key in state) return Reflect.get(state, key);
        if (key in props) return Reflect.get(props, key);
        if (key in target) return Reflect.get(target, key);
        if(key === 'emits') return emits;

        throw Error(`${key}不存在`);
      },

      set(target, key, value) {
        if(typeof key === 'symbol') return false;

        const { state, props } = target;
        if(state && key in state) return Reflect.set(state, key, value);
        if (key in props) console.warn('直接设置props可能导致组件异常');
        if (key in target) return Reflect.set(target, key, value);

        throw Error(`${key}不存在`);
      }
    });
    created && created.call(renderContext);

    effect(() => {
      if(!render) throw Error('组件缺少render函数！');
      
      const subTre = render.call(renderContext);
      if(!instance.subTre) {
        beforeMount && beforeMount.call(renderContext);
        patch(subTre, null, container, anchor);
        // 通过 onMounted 收集的生命周期函数，这里只做一个示例，剩余hooks同理
        instance.mounted && instance.mounted.forEach(fn => fn());
        mounted && mounted.call(renderContext);
      } else {
        beforeUpdate && beforeUpdate.call(renderContext);
        patch(subTre, instance.subTre, container, anchor);
        updated && updated.call(renderContext);
      };

      instance.subTre = subTre;
    });
  };

  function patchComponent(n1: VNode, n2: VNode, container: Element, anchor: Element | null = null) {
    const instance = ((n1.type as ComponentVNode).instance = (n2.type as Required<ComponentVNode>).instance);
    
    const { props: propsOptions } = (n1.type as ComponentVNode);
    const { props: nextProps } = parseProps(propsOptions, n1.props);
  
    for (const key in nextProps) {
      if(instance.props[key] !== nextProps[key]) {
        instance.props[key] = nextProps[key];
      }
    };

    for (const key in instance.props) {
      if(!Reflect.has(nextProps, key)) {
        Reflect.deleteProperty(instance.props, key);
      }
    };
  };

  return {
    render
  };
}