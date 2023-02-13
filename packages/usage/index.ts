import { reactive, effect } from "@vue/reactivity";
import { createRenderer, VNODE, specialVNodeType } from "@vue/renderer";
import { OptionsComponent } from "packages/renderer/src/type";

const obj = reactive({ color: 'blue', name: 'test' });
const obj2 = reactive(['1', '2', '3', '5'])