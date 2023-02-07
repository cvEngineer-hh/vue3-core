# vue3-core

&emsp;用于深入了解、学习vue3使用，包含vue3核心功能，目前已有 响应式模块、渲染模块。

&emsp;使用build.js构建，运行：
`pnpm i`
`pnpm run dev`
然后进入 `/dev/index.html` 运行该文件


## 1. 响应式系统

### 1.1 使用proxy代理对象

  &emsp;proxy可以代理对象的一些内部方法，如以下代码所示，使用proxy代理了一个对象，那在调用`obj.name` 时会触发get函数、执行`obj.name = '张三'` 的时候可以触发 set 函数，因此可以在 get 处收集对应副作用函数、set 处执行副作用函数。这是vue响应式实现的核心
  
````js
const obj = proxy({
	get(target, key, o) {
		return Reflect.get(target, key);
	},
	set(target, key, value, o) {
		return Reflect.set(target, key, value);
	}
})
````

### 1.2 储存副作用函数

&emsp;除了代理对象之外，我们还需要找到与操作属性对应的副作用函数，当我们在vue3中写下如下代码时：
````js
const obj = reactive({
	name: '张三',
});

watchEffect(() => {
	document.querySelect('#app').innerText = obj.name;
});
````

	可以看到，在以上代码中存在三个角色：
	1. 代理对象
	2. 被操作的代理对象的属性
	3. 副作用函数
	此时的对应关系也很清晰：这是一种树形结构；
	
**&emsp;但是随着代理对象增多，对应关系也将更加复杂，这意味着我们需要构建一个合适的结构来储存这些数据，以便管理副作用函数**

&emsp;首先是副作用函数，一个属性可以对应多个副作用函数，且函数不可重复，因此使用 WeakSet 储存是最合适的

&emsp;其次是代理对象的属性，由于需要通过key查找相关副作用函数，因此可以使用 Map 储存 属性 与 副作用函数的对应关系；
	
&emsp;而在实际使用中，代理对象可以有多个，所以我们还需要创建一个 WeakMap 来储存 代理对象 和 根据代理对象的属性创建的Map 的对应关系；

[关于WeakMap](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
[关于WeakSet](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakSet)

### 1.3 注册副作用函数

&emsp;到此为止我们已经做到了 **代理对象** 以及 **储存副作用函数**，但副作用函数此时却无法获取到。我们可以使用特殊名称的变量来储存副作用函数，在收集完副作用后清除该变量，代码略。

&emsp;但因为实际业务的复杂性，这种做法不够灵活，我们可以创建一个函数用于注册副作用函数，传递的参数就是副作用函数，这样即使是匿名函数也可以正常注册和收集。例如vue3中的 `watchEffect`，而运行这个函数也可以观察到vue3注册副作用函数时的大致过程：

    调用传递进来的副作用函数，并在运行时将副作用函数保存在一个全局变量中：`activeEffect`，而运行副作用函数时会触发代理对象的 get 方法，这样代理对象就可以在 get 方法中根据 activeEffect 来收集依赖。

这样就可以实现一个响应式系统了：
````ts
import type { ObjectOfStringKey } from 'shared/src/types';
import type { Effect, Bucket } from './types';

let activeEffect: Effect | undefined;
  
export function effect(cb: () => any) {
  activeEffect = cb;
  activeEffect();
};

export function reactive<T extends ObjectOfStringKey>(raw: T): T {
  return new Proxy(raw, {
    get(target, key) {
      // 暂时不考虑属性为 symbol 的情况
      if (typeof key === 'symbol') return;

      track(target, key);
      return Reflect.get(target, key);
    },

    set(target, key, value) {
      // 暂时不考虑属性为 symbol 的情况
      if (typeof key === 'symbol') return false;

      trigger(target, key);
      return Reflect.set(target, key, value);
    },
  });
};

const bucket: Bucket = new WeakMap();
function track(target: ObjectOfStringKey, key: string) {
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
};

function trigger(target: ObjectOfStringKey, key: string) {
  const targetMap = bucket.get(target);
  if (!targetMap) return;

  const effectSet = targetMap.get(key);
  effectSet?.forEach(effectFn => effectFn());
};
````

### 遗留的副作用函数

&emsp;在执行完副作用函数后，应当及时清除，遗留的副作用函数会对响应式运行造成影响

&emsp;例如遇到分支时（if 或者 三元运算符），即使修改obj.name，结果总会是``李四``，因此此时副作用函数不需要执行，但此时修改``obj.name``还是会执行函数

````javascript
const obj = reactive({
  name: '张三',
  show: false,
});

effect(() => {
  const a = obj.show ? obj.name : '李四'
})
````
**&emsp;我们可以将该函数的依赖项汇集起来，储存在依赖函数上，在每次执行依赖函数之前 清除一遍副作用函数**

### 嵌套的effect

&emsp;到目前为止，我们实现的响应系统只能实现单层的监听
````javascript
const obj = reactive({ x: 1, y: 2 });

effect(() => {
  effect(() => {
    const test = obj.y;
    console.log('内部effect执行');
  })

  const test = obj.x;
  console.log('外部effect执行');
})
````

&emsp;此时运行代码可以看到输出：
````javascript
// 内部effect执行
// 外部effect执行
````

&emsp;而在我们执行``obj.x = 2``时，将会打印 ``内部effect执行``，此时的响应式系统出现了意外
而在vue中嵌套的effect很常见，比如render

&emsp;而原因就出在 activeEffect 上，在执行内部的副作用函数时，activeEffect 被重新赋值，导致在收集``obj.x``时，依赖x的副作用函数被错误地绑定成了内部的副作用函数

**&emsp;我们可以使用一个队列来储存多层的effect，在副作用函数执行完毕后将activeEffect弹出**

====这里发现 内部的副作用函数 会被错误的收集并执行两次，vue也是一样的情况，猜测是副作用函数重新被创建====

### 对象的基本语法操作

&emsp;proxy 可以拦截的对象的基本语法操作
实际就是引擎执行内部方法的操作

&emsp;proxy对象中的内部方法以及拦截器名称
略

### 常规对象 和 异质对象

&emsp;js的所有对象中，任何不属于常规对象的对象都属于异质对象，满足以下三点即为常规对象

* 对于上述的内部方法，必须使用ECMA规范 10.1.x 给出的定义实现
* 对于 Call , ~~~~10.2.1~~~
* 对于 Construct, ~~~10.2.2~~~


**&emsp;而proxy代理对象为异质对象，原因在于，proxy的基本语法操作，会首先调用自身对应的拦截函数，若不存在则调用原对象的内部方法**

&emsp;关于内部方法，是对对象操作时引擎内部调用的方法，对使用者来说时不可见的，对象的实际语义就是由内部方法指定的。

### in、for...in等操作符拦截

&emsp;综上，我们知道引擎内部调用的方法，是可以被proxy拦截的
in操作符会在最后调用 \[\[HasProperty\]\] 内部方法，我们可以使用 has 来拦截in操作符

&emsp;for...in 在执行时会调用 \[\[ownProertyKeys\]\]，所以我们可以使用 ownkeys拦截，**因为ownkeys只能知道调用的对象，所以在处理拦截操作时无法直接监听到某一个key，这里vue中的处理方式是定义一个 symbol，通过这个symbol收集依赖，在proxy对象set操作时执行依赖**

## 2. 渲染器

### 1.renderer 与 render
&emsp;renderer 与 render 并非同一概念，renderer不仅可以渲染dom，也是跨端渲染的关键，renderer 包含 render，通过封装 创建、插入 等dom操作，结合 renderer 传参可实现自定义 渲染

````typescript
interface Options {
  createElement: (type: keyof HTMLElementTagNameMap) => HTMLElement,
  setContentText: (el: Container, text: string) => void,nt: Container, children: 
  HTMLElement, anchor: HTMLElement | null) => void,
};

export function createRenderer(options?: Options) {
  options = options || {
    createElement: type => document.createElement(type),

    setContentText: (el, text) => el.textContent = text,

    insert: (parent, children, anchor) => parent.insertBefore(children, anchor),
  };

  function render() {...}
  return {
	  render
  }
 }
````

### 2. HTML Attributes 与 DOM properties

&emsp;HTML Attributes 虽然部分属性与 DOM priperties 相同（通常我们称相同的为 直接映射），但二者机制存在一定差异
	例如 
	
```` vue
<template>
	<input value="1"/>
</template>

<script>
const el = document.querySelect('input');

el.value = '2';
conslole.log(el.value);// 2
conslole.log(el.defaultValue);// 1
console.log(el.getAttribute('value'));// 1
</script>
````

**&emsp;HTML Attributes 是设置与之对应的DOM priperties的初始值，并且使用sestAttribute设置的值总是为string**


### 3.diff算法

&emsp;diff算法可以减少使用者的心智负担，牺牲一部分性能 来找出需要更新的节点，以最少的dom操作完成更新。
	
**&emsp;为了方便渲染，我们约定虚拟节点的children类型: string | VNode[]**

&emsp;新节点或旧节点有一个是文本节点的情况下，只需清空节点后挂载上新节点即可：
````typescript
function emptyEl() {
  if (typeof oldNode.children === 'string') {
    setContentText(el, '');
  }
  if (Array.isArray(oldNode.children)) {
    oldNode.children.forEach(n => unmount(el))
  }
}
````

而需要使用diff算法的情况是新旧节点均为数组的情况，并且需要key值辅助判断

#### 3.1 查找可以复用的节点

// 此处忽略

#### 3.2 移动节点
&emsp;insertBefore用于在锚点节点之前插入节点，但如果插入的节点在文档中时，该节点会被移动，我们可以使用该方法来移动可复用的节点

&emsp;该方法接受三个参数：要插入节点的父节点、要插入的节点 以及 锚点节点。因此只要找出锚点节点，可复用的节点就可以被移动。

&emsp;锚点节点的位置可以参考vnode，即当前节点的下一个节点，但因为在查找可复用节点时使用的循环是正向的，在更新结束之前只有该节点之前的节点位置被正确更新，因此锚点节点只能借助上一节点查找。

&emsp;因为在更新中我们复制了dom的引用，所以上一节点的真实dom的下一节点就是真实的锚点节点：`newChildren[i - 1].el.nextSibling`

**&emsp;但是这种方法在部分情况下不够精简，比如从[1, 2, 3] 更新到 [3, 2, 1]，只替换了首尾，但该方法会移动两次节点，使用双端diff算法可以解决该问题**

#### 3.3 双端diff算法

&emsp;双端diff算法是vue2使用的diff算法，主要操作是 取新旧节点的首尾节点 两两比较，查找出可以复用的节点，然后不断向中间收缩下标以查找所有节点。这种算法一次可以比较四个节点，并且容易理解。
	
&emsp;但是在循环中，四个节点可能都无法复用，或者有一个新增节点，此时需要补充逻辑来处理这一情况。

#### 3.4 快速diff算法

&emsp;快速diff算法在实测中性能优于`双端diff算法`，也是vue3所使用的diff算法。这种算法使用了大量的处理来查找可复用且不需要移动的节点；

* 分别从新节点的首、尾开始遍历，直到遇到不可复用的节点为止，这一步处理将排除节点两头不需要移动的节点；
* 遍历新节点中剩余的节点，使用一个数组保存新节点在旧节点中可复用的节点下标，然后查找这个数组中的 `最长增序子序列`，子序列所对应下标的节点不需要处理；
* 移动节点；

##### 3.4.1 关于最长增序子序列
&emsp;此处可能需要解释一下为什么 `最长增序子序列` 所对应下标的节点不需要处理，假设有以下一组新旧节点：
	
![[./img/微信图片_20230119180646.png]]

&emsp;可以看出新旧节点的位置没有变化，所以只需要更新节点，不需要移动节点，此时新节点在旧节点中可复用的节点的 下标集合 是 `[0, 1, 2, 3]`，呈递增趋势；

&emsp;当节点移动后，其对应的下标集合是 `[0, 2, 1, 3]`，递增趋势被打破了：

![[./img/微信图片_20230119181251.png]]

&emsp;此时需要移动节点，而当前下标集合的 最长递增子序列 是 `[0, 2, 3]` 或  `[0, 1, 3]`（是的 最长递增子序列可以有多个，使用其中任意一条即可完成dom移动），所对应的信息分别为 `n1, n3, n4` 不需要移动； 或者 `n1, n2, n4` 不需要移动，也就是说此时只需要移动 n2 或 n3即可，而实际情况也是只移动 n2 或者 n3 就足够完成更新；

##### 3.4.2 新增节点 以及 删除节点
&emsp;除了移动节点之外，diff算法还需要寻找新增、删除的节点；

&emsp;找出新增节点比较容易，只需要在更新节点时，在旧节点中没有找到可复用的节点时 即为新增节点，此时只需要找到锚点并挂载即可；

&emsp;如果需要找出被删除的节点，可以使用变量储存被处理过的节点数量，当这个变量等于新节点的长度时，说明剩下的节点都在新节点中不存在；