import { ref } from "@vue/reactivity";
import { ComponentVNode } from "packages/renderer/src/type";

export default {
  name: 'app',
  
  
  setup(props, { emits }) { 
    const num = ref<number>(0);
    
    return function () {
      return {
      
        type: 'div',
        children: [
          {
          
            type: 'input',
            props: {
              value: num.value,
              type: 'number',
              onchange: (e: InputEvent) => {
                num.value = +(e.target as HTMLInputElement).value || 0
              }
            },
          },
          {
          
            type: 'div',
            children: [
              {
              
                type: 'span',
                children: '+',
                props: {
                  style: {
                    fontSize: '40px'
                  },
                  onclick: () => {
                    num.value += 1;
                  }
                }
              }, {
              
                type: 'span',
                children: '-',
                props: {
                  style: {
                    marginLeft: '40px',
                    fontSize: '40px'
                  },
                  onclick: () => {
                    num.value -= 1;
                  }
                }
              }
            ]
          },
          {
          
            type: 'div',
            children: `num: ${num.value}`,
          
          }
        ]
      }
    }
  }
} as ComponentVNode;