import { createEmits } from "./common";

interface Props extends Partial<Omit<HTMLElement, 'style' | 'className'>>, Record<string, any> {
  style?: Partial<CSSStyleDeclaration>,
  className?: {[key in string]: boolean} | string,
}

export type PropsOptions = {
  [key in string]: { type: any, default?: (() => any) | unknown }
};

type LifecycleHooks = 'beforeCreate' | 'created' |'beforeMount' |'mounted' |'beforeUpdate' |'updated';
export interface ComponentInstance extends Partial<Record<LifecycleHooks, (() => void)[]>>{
  props: Record<string, any>,
  attrs: Record<string, any>,
  state: Record<string, any> | null,
  subTre: VNode | null,
};

type setupContext = {
  attrs: ComponentInstance['props'],
  emits: ReturnType<typeof createEmits>,
};
export interface ComponentVNode extends Partial<Record<LifecycleHooks, () => void>> {
  name?: string,
  props?: PropsOptions,
  data?: () => object,
  setup?: (props: ComponentInstance['props'], context: setupContext) => (object | ComponentVNode['render']),
  render?: () => VNode,

  instance?: ComponentInstance,
};

interface El extends HTMLElement { 
  _vei?: Record<string, { value: Array<(e: Event) => void> | ((e: Event) => void) }>,
  className: string,
};
export type VNode = {
  el?: El,
  key?: string,
  type: ComponentVNode | keyof HTMLElementTagNameMap,
  props?: Props | null,
  children?: string | VNode[],
};