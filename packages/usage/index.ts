import { reactive, effect } from "@vue/reactivity";
import { createRenderer, VNODE, specialVNodeType } from "packages/renderer";

const obj = reactive({ color: 'blue' });
const obj2 = reactive(['张三', '李四', '王五'])

window.onload = () => { 
  window.obj = obj
  
  const a = createRenderer();
  // effect(() => { 
  //   console.log(obj.name);
  // })

  effect(() => { 
    const vnode = {
      // children: obj.color === 'red' ? obj2.map(item => ({ type: specialVNodeType.Comment, children: item })) : '测试',
      // children: obj.color === 'red' ? [{type: specialVNodeType.Fragment, children: obj2.map(item => ({ type: 'div', children: item }))}] : '测试',
    //   children: [{
    //     type: specialVNodeType.Fragment,
    //   children: obj2.map(item => ({ type: 'div', children: item, key: item, }))
    // }],
      children: obj2.map(item => ({ type: 'div', children: item, key: item, })),
      type: 'div',
      props: {
        className: {
          test: true,
          box: false,
        },
        style: {
          color: obj.color
        },
        onclick(e) { 
          console.log('点击点击', e);
        },
      },
      // children: obj.map(tag => ({ type: 'p', children: tag }))
    }
    a.render(vnode);

    let newContainer = document.querySelector('.new-container');
    if (!newContainer) { 
      newContainer = document.createElement('div');
      newContainer.className = 'new-container'
      document.body.append(newContainer);
      
        a.render({
          type: specialVNodeType.Fragment,
          el: undefined,
          children: [
            {
              el: undefined,
              type: 'div',
              children: '变红',
              props: {
                onclick() { 
                  obj.color = 'red';
                }
              }
            }, {
              el: undefined,
              type: 'div',
              children: '变长',
              props: {
                onclick(e) { 
                  obj2.push('测试' + e.timeStamp)
                }
              }
            }, {
              el: undefined,
              type: 'div',
              children: '变短',
              props: {
                onclick(e) { 
                  obj2.pop()
                }
              }
            }, {
              el: undefined,
              type: 'div',
              children: '转换',
              props: {
                onclick(e) { 
                  a.render(
                    {
                      // children: obj.color === 'red' ? obj2.map(item => ({ type: specialVNodeType.Comment, children: item })) : '测试',
                      // children: obj.color === 'red' ? [{type: specialVNodeType.Fragment, children: obj2.map(item => ({ type: 'div', children: item }))}] : '测试',

                      type: 'div',
                      children: ['王五',  '李四', '测试', ].map(item => ({ type: 'div', children: item, key: item, })),
                      props: {
                        className: {
                          test: true,
                          box: false,
                        },
                        style: {
                          color: obj.color
                        },
                        onclick(e) { 
                          console.log('点击点击', e);
                        },
                      },
                      // children: obj.map(tag => ({ type: 'p', children: tag }))
                    }
                  )
                }
              }
            },
          ]
        }, newContainer)
    }

    console.log(vnode, 'vnode');
    
  })
}