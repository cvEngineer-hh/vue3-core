import { createRenderer } from '@vue/renderer';
import App from './App';

const renderer = createRenderer();
window.onload = () => { 
  renderer.render({
    type: App,
  });
}