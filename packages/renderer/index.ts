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
  key?: string,
  props?: Props,
  children?: VNODE[] | string,
}

interface Container extends HTMLElement { 
  _vnode?: VNODE,
}

interface Options {
  createElement: (type: keyof HTMLElementTagNameMap) => HTMLElement,

  createComment: (comment: string) => Comment,

  setContentText: (el: Container, text: string) => void,

  insert: (parent: Container, children: HTMLElement | Comment, anchor: HTMLElement | ChildNode | null) => void,

  updateProps: (el: VNODE['el'], key: string, value: any) => void,
};

export function createRenderer(options?: Options) { 
  // 自定义渲染函数，跨平台能力的关键
  // 暴露给全局，供内部函数使用
  options = options || {
    createElement: type => document.createElement(type),
    createComment: comment => document.createComment(comment),
    setContentText: (el, text) => el.textContent = text,
    insert: (parent, children, anchor) => parent.insertBefore(children, anchor),
    updateProps: (el, key, value) => { 
      
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
    updateProps,
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

  function mountElement(vnode: VNODE | VNODE['children'], container: Container, anchor: HTMLElement | ChildNode | null): void {
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
            updateProps(el, key, vnode.props[key]);
          }
        }

        insert(container, el, anchor);
        mountElement(vnode.children, el);
      }
    };

    if (typeof vnode === 'string') setContentText(container, vnode);
  };

  // 更新props
  function patchProps(newProps: VNODE['props'], oldProps: VNODE['props'], el: VNODE['el']) { 
    if (!newProps) {
      for (const key in oldProps) {
        updateProps(el, key, null);
      }
    } else if (!oldProps) {
      for (const key in newProps) {
        updateProps(el, key, newProps[key]);
      }
    } else { 
      for (const key in oldProps) {
        if (newProps[key] !== oldProps[key]) { 
          updateProps(el, key, newProps[key]);
        }
      }
  
      for (const key in newProps) {
        if (!Reflect.has(oldProps, key)) { 
          updateProps(el, key, newProps[key]);
        }
      }
  
    }
  };

  // 更新节点，只比对新旧节点的公共长度，剩余的部分通过判断新旧节点长度进行新增或者删除操作，性能较差
  function emptyEl(node: VNODE, el: VNODE['el']) { 
    if (typeof node.children === 'string') { 
      setContentText(el, '');
    }

    if (Array.isArray(node.children)) { 
      node.children.forEach(n => unmount(n.el))
    }
  }
  function patchChildren_v1(n1: VNODE, n2: VNODE, el: VNODE['el']) { 
    if (typeof n1.children === 'string') { 
      emptyEl(n2, el);
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
        emptyEl(n2, el);
        mountElement(n1.children, el);
      }
    }
  };

  // 快速diff算法
  function patchChildren_fast(n1: VNODE, n2: VNODE, el: VNODE['el']) {
    function emptyEl() { 
      if (typeof n2.children === 'string') { 
        setContentText(el, '');
      }
  
      if (Array.isArray(n2.children)) { 
        n2.children.forEach(n => unmount(el))
      }
    }
    if (typeof n1.children === 'string') { 
      emptyEl();
      setContentText(el, n1.children);
    }
  
    if (Array.isArray(n1.children)) { 
      if (!Array.isArray(n2.children)) {
        emptyEl();
        mountElement(n1.children, el);
      } else {

        // 先检查新旧节点中不需要移动的节点，也就是节点的首尾
        let start = 0;
        while (n1.children[start]?.key == n2.children[start]?.key) {
          patch(n2.children[start], n1.children[start], el);
          start++;
        }

        let newEndIndex = n1.children.length - 1;
        let oldEndIndex = n2.children.length - 1;
        while (n1.children[newEndIndex].key == n2.children[oldEndIndex].key) {
          patch(n2.children[oldEndIndex], n1.children[newEndIndex], el);
          newEndIndex--;
          oldEndIndex--;
        }

        // 通过 newEndIndex 查找新增的元素，手动挂载
        if(oldEndIndex < start && newEndIndex >= start) {
          for(let i = start; i <= newEndIndex; i++) {
            mountElement(n1.children[i], el, n1.children[i - 1].el.nextSibling);
          }
        }

        if(newEndIndex < start && oldEndIndex >= start) {
          for(let i = start; i <= oldEndIndex; i++) {
            unmount(n2.children[i].el);
          }
        }
      }
    }

  };


  // 基础diff，遍历新节点，搜索旧节点中是否存在可复用的节点，找出位置后使用insertBefore移动节点
  // 该方式只能一步一步移动节点，部分情况下的操作不够精简，查找出的移动节点的方式还有优化空间
  function patchChildren_V2(n1: VNODE, n2: VNODE, el: VNODE['el']) {
    if (typeof n1.children === 'string') { 
      emptyEl(n2, el);
      setContentText(el, n1.children);
    }
  
    if (Array.isArray(n1.children)) { 
      if (typeof n2.children === 'string') { 
        emptyEl(n2, el);
        mountElement(n1.children, el);
        return;
      }

      // 遍历新节点，查找需要移动的节点并手动移动
      let lastIndex = 0;
      n1.children.forEach((newChildren, i) => {
        const existReusable = (n2.children as VNODE[]).some((oldChildren, j) => {
          if (newChildren.key !== oldChildren.key) return false;
          patch(oldChildren, newChildren, el);

          if (j < lastIndex) {
            i > 0 && insert(el, newChildren.el, (n1.children as VNODE[])[i - 1].el.nextSibling);
          } else {
            lastIndex = j;
          }

          return true;
        });

        // 若没找到可复用的节点，则手动新增
        if (!existReusable) {
          patch(undefined, newChildren, el);
          i > 0 && insert(el, newChildren.el, (n1.children as VNODE[])[i - 1].el.nextSibling);
        };
      });

      // 移动结束后查看旧节点中有没有被删除的节点，存在则手动删除
      (n2.children as VNODE[]).some(oldChildren => { 
        if (!(n1.children as VNODE[]).some(newChildren => oldChildren.key === newChildren.key)) {
          unmount(oldChildren.el);
          return true;
        }
      })
    }
  }
  
  // 双端diff，取新旧节点的首尾节点逐次比较，并逐渐向节点中部收缩索引
  function patchChildren(n1: VNODE, n2: VNODE, el: VNODE['el']) { 
    // debugger

    if (typeof n1.children === 'string') { 
      emptyEl(n2, el);
      setContentText(el, n1.children);
      return;
    }
  
    if (Array.isArray(n1.children)) {
      if (!n2.children) return mountElement(n1.children, el);
      if (typeof n2.children === 'string') {
        emptyEl(n2, el);
        mountElement(n1.children, el);
        return;
      }

      let newNodeStartIndex = 0,
        oldNodeStartIndex = 0,
        newNodeEndIndex = n1.children.length - 1,
        oldNodeEndIndex = n2.children.length - 1;
      
      while (newNodeStartIndex <= newNodeEndIndex && oldNodeStartIndex <= oldNodeEndIndex) { 
        const newNodeStart = n1.children[newNodeStartIndex];
        const oldNodeStart = n2.children[oldNodeStartIndex];
        const newNodeEnd = n1.children[newNodeEndIndex];
        const oldNodeEnd = n2.children[oldNodeEndIndex];
        
        if (!oldNodeStart.el) { 
          oldNodeStartIndex++;
          continue;
        };
        if (!oldNodeEnd.el) { 
          oldNodeEndIndex--;
          continue;
        };

        // 新旧节点的首（尾）节点可以复用时，节点不需要移动
        if (newNodeStart.key === oldNodeStart.key) { 
          patch(oldNodeStart, newNodeStart, el);
          newNodeStartIndex++;
          oldNodeStartIndex++;
          continue;
        };
        if (newNodeEnd.key === oldNodeEnd.key) { 
          patch(oldNodeEnd, newNodeEnd, el);
          newNodeEndIndex--;
          oldNodeEndIndex--;
          continue;
        };

        // 新节点的头部节点key 与 旧节点的尾部节点key 相等时，说明旧节点的尾部节点被移动到 oldNodeStart 的上方
        if (newNodeStart.key === oldNodeEnd.key) {
          patch(oldNodeEnd, newNodeStart, oldNodeEnd.el);
          insert(el, oldNodeEnd.el, oldNodeStart.el);
          newNodeStartIndex++;
          oldNodeEndIndex--;
          continue;
        }

          // 新节点的尾部节点key 与 旧节点的头部节点key 相等时，说明当前旧节点的头部节点被移动到尾部，也就是 oldNodeEnd 的下方
        if (oldNodeStart.key === newNodeEnd.key) {
          patch(oldNodeStart, newNodeEnd, oldNodeStart.el);
          insert(el, oldNodeStart.el, oldNodeEnd.el.nextSibling);
          oldNodeStartIndex++;
          newNodeEndIndex--;
          continue;
        }

        const i = n2.children.findIndex(oldNode => oldNode.key === newNodeStart.key);
        
        // 当四个节点都匹配不上时，直接在旧节点中查找头节点并更新
        if (i > 0) {
          const oldNode = n2.children[i];
          patch(oldNode, newNodeStart, el);
          insert(el, newNodeStart.el, oldNodeStart.el);
          oldNode.el = undefined;// 将el置空，用来表示该节点已被复用
          newNodeStartIndex++;
        } else { 
          // 没有找到可复用的节点时，直接挂载
          const lastnode = n1.children[newNodeStartIndex - 1]?.el;
          mountElement(newNodeStart, el, lastnode?.nextSibling);
          newNodeStartIndex++;
        }
      }

      // 如果最终旧节点全部被复用后，剩下的节点便都是新增节点
      if (oldNodeStartIndex > oldNodeEndIndex && newNodeStartIndex <= newNodeEndIndex) { 
        const anchor = n1.children[newNodeEndIndex + 1]?.el;
        for (let index = newNodeStartIndex; index <= newNodeEndIndex; index++) {
          mountElement(n1.children[index], el, anchor);
        }
      }

      if (newNodeStartIndex > newNodeEndIndex && oldNodeStartIndex <= oldNodeEndIndex) { 
        for (let index = oldNodeStartIndex; index <= oldNodeEndIndex; index++) {
          unmount(n2.children[index].el);
        }
      }
      
    }
  }

  // n1: newVNode, n2: oldVNode
  function patchElement(n1: VNODE, n2: VNODE, container: Container) { 
    const el = n1.el = n2.el;

    patchProps(n1.props, n2.props, el);
    patchChildren_fast(n1, n2, el);
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