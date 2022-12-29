export const test = () => { }

export function microtasksThrottle(fn: Function) { 
  let isFinish = true;
  if (!isFinish) return;

  isFinish = false;
  Promise.resolve(() => { 
    fn();
    isFinish = true;
  })
}
