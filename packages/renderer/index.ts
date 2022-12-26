interface Props extends Omit<HTMLElement, 'className' | 'style'> { 
  style: Partial<CSSStyleDeclaration>
  className: { [key: string]: boolean } | any[] | string,
  [key: string]: any,
}

interface vueEventInvoker { 
  (e: Event): any,
  attached: number, 
  value: (e: Event) => any | ((e: Event) => any)[]
}
interface EL extends HTMLElement { 
  _vei?: Partial<Record<keyof HTMLElementEventMap, vueEventInvoker>>
}

export enum specialVNodeType { 
  Comment,
  Fragment,
}

export type VNODE = {
  el: EL,
  type: keyof HTMLElementTagNameMap | number,
  props?: Props,
  children?: VNODE | VNODE[] | string,
}

interface Container extends HTMLElement { 
  _vnode?: VNODE,
}

interface Options {
  createElement: (type: keyof HTMLElementTagNameMap) => HTMLElement,

  createComment: (comment: string) => Comment,

  setContentText: (el: Container, text: string) => void,

  insert: (parent: Container, children: HTMLElement | Comment, anchor: HTMLElement | null) => void,

  patchProps: (el: VNODE['el'], key: string, value: any) => void,
};
export function createRenderer(options?: Options) { 
  // 自定义渲染函数，跨平台能力的关键
  // 暴露给全局，供内部函数使用
  options = options || {
    createElement: type => document.createElement(type),
    createComment: comment => document.createComment(comment),
    setContentText: (el, text) => el.textContent = text,
    insert: (parent, children, anchor) => parent.insertBefore(children, anchor),
    patchProps: (el, key, value) => { 
      
      if (key === 'className') return el.className = classNameToString(value);
      if (key === 'style') { 
        for (const key in value) {
          Reflect.set(el.style, key, value[key])
        }
        return
      }

      if (/^on/.test(key)) { 
        const eventName = key.slice(2).toLowerCase();

        const invokers = el._vei || (el._vei = {});
        let invoker = invokers[eventName as keyof HTMLElementEventMap];

        if (!invoker) {
          // 将事件用调用器包裹并保存在value属性下，在更新事件时只需要给value重新赋值即可
          // 为了避免冒泡对函数执行造成影响，在调用后挂载的事件classNameToString不会执行
          invoker = (e => { 
            if (e.timeStamp < Number(invoker?.attached)) return;
            if (Array.isArray(invoker?.value)) return invoker?.value.forEach(fn => fn(e))
            invoker?.value(e);
          }) as vueEventInvoker;
          invoker.value = value;
          // 添加绑定时间，用于与执行时间比较
          invoker.attached = performance.now();
          
          el.addEventListener(eventName, invoker);
          Reflect.set(invokers, eventName, invoker);
        } else { 
          invoker.value = value
        }

        return;
      }

      if (!shouldSetAsProps(el, key, value)) return el.setAttribute(key, value);
  
      const readOnlyKeys = ['ATTRIBUTE_NODE', 'CDATA_SECTION_NODE', 'COMMENT_NODE', 'DOCUMENT_FRAGMENT_NODE'];
      if (readOnlyKeys.includes(key)) return;
  
      if (typeof el[key as keyof HTMLElement] === 'boolean' && value === '') value = true;
      Reflect.set(el, key, value);
    },
  };

  // 在函数内暴露，方便内部函数调用
  const { 
    createElement,
    createComment,
    setContentText,
    insert,
    patchProps,
  } = options;

  function classNameToString(className: any): string { 
    if(!className) return ''
    if (Array.isArray(className)) return className.join(' ');
    if (typeof className === 'object') { 
      return Object.keys(className).reduce((pre, key) => className[key] ? `${pre} ${key}` : pre, '')
    }

    if (typeof className === 'string') return className;
    new Error('className 必须为 string、array或object!')
    return '';
  };
  
  // 一些需要特殊处理的属性
  function shouldSetAsProps(el: HTMLElement, key: string, value: any) { 
    if (key === 'from' && el.tagName === 'INPUT') return true;

    return key in el;
  }

  function mountElement(vnode: VNODE | VNODE['children'], container: Container): void {
    if (Array.isArray(vnode)) return vnode.forEach(node => mountElement(node, container));
    
    if (typeof vnode === 'object') {
      if (vnode.type === specialVNodeType.Fragment) { 
        vnode.el = container;
        mountElement(vnode.children, container);
      }

      if (vnode.type == specialVNodeType.Comment) { 
        insert(container, createComment(vnode.children as string), null);
      }

      if (typeof vnode.type === 'string') { 
        // 将渲染的dom保存在虚拟节点的el属性下，便于执行dom相关操作
        const el = vnode.el = createElement(vnode.type);

        if (Reflect.has(vnode, 'props')) { 
          for (const key in vnode.props) {
            patchProps(el, key, vnode.props[key]);
          }
        }
        insert(container, el, null);
        mountElement(vnode.children, el);
      }
    };

    if (typeof vnode === 'string') setContentText(container, vnode);
  };
  
  // n1: newVNode, n2: oldVNode
  function patchElement(n1: VNODE, n2: VNODE, container: Container) { 
    const el = n1.el = n2.el;
    const newProps = n1.props;
    const oldProps = n2.props;

    // 更新props
    if (!newProps) {
      for (const key in oldProps) {
        patchProps(el, key, null);
      }
    } else if (!oldProps) {
      for (const key in newProps) {
        patchProps(el, key, newProps[key]);
      }
    } else { 
      for (const key in oldProps) {
        if (newProps[key] !== oldProps[key]) { 
          patchProps(el, key, newProps[key]);
        }
      }

      for (const key in newProps) {
        if (!Reflect.has(oldProps, key)) { 
          patchProps(el, key, newProps[key]);
        }
      }

    }

    function emptyEl() { 
      if (typeof n2.children === 'string') { 
        setContentText(el, '');
      }

      if (Array.isArray(n2.children)) { 
        n2.children.forEach(n => unmount(el))
      }
    }
    
    // 更新节点
    if (typeof n1.children === 'string') { 
      emptyEl();
      setContentText(el, n1.children);
    }

    if (Array.isArray(n1.children)) { 
      if (Array.isArray(n2.children)) {
        const newChildrenLength = n1.children.length;
        const oldChildrenLength = n2.children.length;
        const commonLength = Math.min(newChildrenLength, oldChildrenLength);

        // 新节点的数量并不一定与旧节点相同，此处先遍历短的部分，然后通过节点长度判断剩下的节点是删除还是新增
        for (let i = 0; i < commonLength; i++) { 
          patch(n2.children[i], n1.children[i], el);
        }
        
        if (newChildrenLength > oldChildrenLength) { 
          for (let i = commonLength; i < newChildrenLength; i++) { 
            mountElement(n1.children[i], el);
          }
        }
        
        if (newChildrenLength < oldChildrenLength) { 
          for (let i = commonLength; i < oldChildrenLength; i++) { 
            unmount(n2.children[i].el);
          }
        }
      } else { 
        emptyEl();
        mountElement(n1.children, el);
      }
    }
  };

  function patch(oldVNode: VNODE | undefined, newVNode: VNODE, container: Container) { 

    // 处理文本节点、注释节点操作 懒得写，以下逻辑错误
    /* if (newVNode.type == specialVNodeType.Comment) { 
      if (!oldVNode) {
        insert(newVNode.el, createComment(newVNode.children as string), null);
      } else { 
        setContentText(oldVNode.el, newVNode.children as string)
      }
      return;
    } */
    
    if (!oldVNode) {
      mountElement(newVNode, container);
    } else { 
      patchElement(newVNode, oldVNode, container);
    }
  };
  
  function unmount(el: HTMLElement) { 
    el.parentNode?.removeChild(el);
  }

  function render(vnode: VNODE, container: Container | null = document.querySelector('#app')) {
    if (!container) throw Error('container of null');

    if (vnode) { 
      patch(container._vnode, vnode, container)
    } else if (container._vnode) { 
      // 新节点不存在 但是存在旧节点，说明是卸载
      unmount(container._vnode.el);
    };

    container._vnode = vnode;
  }

  return {
    render,
  };
}