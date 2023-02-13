import { ObjectOfStringKey } from 'packages/shared/src/types';
import { VNODE } from '.';

export type OptionsComponent = {
  name: string,
  data: () => object,
  props?: ObjectOfStringKey,
  render?: (obj: any) => VNODE,

  beforeCreate?: Function,
  created?: Function,
  beforeMount?: Function,
  mounted?: Function,
  beforeUpdate?: Function,
  updated?: Function,
};

export type ComponentsComponent = {
  setup: () => ComponentsComponent['render'] | VNODE,
  render?: (obj: any) => VNODE,
};