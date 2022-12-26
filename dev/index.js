"use strict";
(() => {
  // packages/reactivity/src/index.ts
  var effectMap = /* @__PURE__ */ new WeakMap();
  function getEffectSet(target, key) {
    let targetMap = effectMap.get(target);
    if (!targetMap) {
      effectMap.set(target, targetMap = /* @__PURE__ */ new Map());
    }
    let effectSet = targetMap.get(key);
    if (!effectSet) {
      targetMap.set(key, effectSet = /* @__PURE__ */ new Set());
    }
    return effectSet;
  }
  function track(target, key) {
    if (!activeEffect)
      return;
    const effectSet = getEffectSet(target, key);
    effectSet.add(activeEffect);
    activeEffect.deps.push(effectSet);
  }
  function trigger(target, key) {
    const targetMap = effectMap.get(target);
    if (!targetMap)
      return;
    const effectSet = targetMap.get(key);
    if (!effectSet)
      return;
    const newEffectSet = new Set(effectSet);
    newEffectSet.forEach((effect2) => {
      effect2 !== activeEffect && effect2();
    });
  }
  function reactive(raw) {
    return new Proxy(raw, {
      get(target, key, receiver) {
        track(target, key);
        return Reflect.get(target, key, receiver);
      },
      set(target, key, value, receiver) {
        const res = Reflect.set(target, key, value);
        trigger(target, key);
        return res;
      }
    });
  }
  function clearOverdueEffect(effect2) {
    effect2.deps.forEach((effectSet) => {
      effectSet.clear();
    });
    effect2.deps.length = 0;
  }
  var activeEffect;
  var activeEffectQueue = [];
  function effect(cb) {
    const effectFn = () => {
      clearOverdueEffect(effectFn);
      activeEffect = effectFn;
      activeEffectQueue.push(effectFn);
      cb();
      activeEffectQueue.pop();
      activeEffect = activeEffectQueue[activeEffectQueue.length - 1];
    };
    effectFn.deps = [];
    effectFn();
  }

  // packages/renderer/index.ts
  function createRenderer(options) {
    options = options || {
      createElement: (type) => document.createElement(type),
      createComment: (comment) => document.createComment(comment),
      setContentText: (el, text) => el.textContent = text,
      insert: (parent, children, anchor) => parent.insertBefore(children, anchor),
      patchProps: (el, key, value) => {
        if (key === "className")
          return el.className = classNameToString(value);
        if (key === "style") {
          for (const key2 in value) {
            Reflect.set(el.style, key2, value[key2]);
          }
          return;
        }
        if (/^on/.test(key)) {
          const eventName = key.slice(2).toLowerCase();
          const invokers = el._vei || (el._vei = {});
          let invoker = invokers[eventName];
          if (!invoker) {
            invoker = (e) => {
              if (e.timeStamp < Number(invoker == null ? void 0 : invoker.attached))
                return;
              if (Array.isArray(invoker == null ? void 0 : invoker.value))
                return invoker == null ? void 0 : invoker.value.forEach((fn) => fn(e));
              invoker == null ? void 0 : invoker.value(e);
            };
            invoker.value = value;
            invoker.attached = performance.now();
            el.addEventListener(eventName, invoker);
            Reflect.set(invokers, eventName, invoker);
          } else {
            invoker.value = value;
          }
          return;
        }
        if (!shouldSetAsProps(el, key, value))
          return el.setAttribute(key, value);
        const readOnlyKeys = ["ATTRIBUTE_NODE", "CDATA_SECTION_NODE", "COMMENT_NODE", "DOCUMENT_FRAGMENT_NODE"];
        if (readOnlyKeys.includes(key))
          return;
        if (typeof el[key] === "boolean" && value === "")
          value = true;
        Reflect.set(el, key, value);
      }
    };
    const {
      createElement,
      createComment,
      setContentText,
      insert,
      patchProps
    } = options;
    function classNameToString(className) {
      if (!className)
        return "";
      if (Array.isArray(className))
        return className.join(" ");
      if (typeof className === "object") {
        return Object.keys(className).reduce((pre, key) => className[key] ? `${pre} ${key}` : pre, "");
      }
      if (typeof className === "string")
        return className;
      new Error("className \u5FC5\u987B\u4E3A string\u3001array\u6216object!");
      return "";
    }
    ;
    function shouldSetAsProps(el, key, value) {
      if (key === "from" && el.tagName === "INPUT")
        return true;
      return key in el;
    }
    function mountElement(vnode, container) {
      if (Array.isArray(vnode))
        return vnode.forEach((node) => mountElement(node, container));
      if (typeof vnode === "object") {
        if (vnode.type === 1 /* Fragment */) {
          vnode.el = container;
          mountElement(vnode.children, container);
        }
        if (vnode.type == 0 /* Comment */) {
          insert(container, createComment(vnode.children), null);
        }
        if (typeof vnode.type === "string") {
          const el = vnode.el = createElement(vnode.type);
          if (Reflect.has(vnode, "props")) {
            for (const key in vnode.props) {
              patchProps(el, key, vnode.props[key]);
            }
          }
          insert(container, el, null);
          mountElement(vnode.children, el);
        }
      }
      ;
      if (typeof vnode === "string")
        setContentText(container, vnode);
    }
    ;
    function patchElement(n1, n2, container) {
      const el = n1.el = n2.el;
      const newProps = n1.props;
      const oldProps = n2.props;
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
        if (typeof n2.children === "string") {
          setContentText(el, "");
        }
        if (Array.isArray(n2.children)) {
          n2.children.forEach((n) => unmount(el));
        }
      }
      if (typeof n1.children === "string") {
        emptyEl();
        setContentText(el, n1.children);
      }
      if (Array.isArray(n1.children)) {
        if (Array.isArray(n2.children)) {
          const newChildrenLength = n1.children.length;
          const oldChildrenLength = n2.children.length;
          const commonLength = Math.min(newChildrenLength, oldChildrenLength);
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
    }
    ;
    function patch(oldVNode, newVNode, container) {
      if (!oldVNode) {
        mountElement(newVNode, container);
      } else {
        patchElement(newVNode, oldVNode, container);
      }
    }
    ;
    function unmount(el) {
      var _a;
      (_a = el.parentNode) == null ? void 0 : _a.removeChild(el);
    }
    function render(vnode, container = document.querySelector("#app")) {
      if (!container)
        throw Error("container of null");
      if (vnode) {
        patch(container._vnode, vnode, container);
      } else if (container._vnode) {
        unmount(container._vnode.el);
      }
      ;
      container._vnode = vnode;
    }
    return {
      render
    };
  }

  // packages/usage/index.ts
  var obj = reactive({ color: "blue" });
  var obj2 = reactive(["\u5F20\u4E09", "\u674E\u56DB"]);
  window.onload = () => {
    window.obj = obj;
    const a = createRenderer();
    effect(() => {
      const vnode = {
        children: [{ type: 1 /* Fragment */, children: obj2.map((item) => ({ type: "div", children: item })) }],
        type: "div",
        props: {
          className: {
            test: true,
            box: false
          },
          style: {
            color: obj.color
          },
          onclick(e) {
            console.log("\u70B9\u51FB\u70B9\u51FB", e);
          }
        }
      };
      a.render(vnode);
      let newContainer = document.querySelector(".new-container");
      if (!newContainer) {
        newContainer = document.createElement("div");
        newContainer.className = "new-container";
        document.body.append(newContainer);
        a.render({
          type: 1 /* Fragment */,
          el: void 0,
          children: [
            {
              el: void 0,
              type: "div",
              children: "\u53D8\u7EA2",
              props: {
                onclick() {
                  obj.color = "red";
                }
              }
            },
            {
              el: void 0,
              type: "div",
              children: "\u53D8\u957F",
              props: {
                onclick(e) {
                  obj2.push("\u6D4B\u8BD5" + e.timeStamp);
                }
              }
            },
            {
              el: void 0,
              type: "div",
              children: "\u53D8\u77ED",
              props: {
                onclick(e) {
                  obj2.pop();
                }
              }
            }
          ]
        }, newContainer);
      }
      console.log(vnode, "vnode");
    });
  };
})();
