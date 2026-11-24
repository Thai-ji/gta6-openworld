// sprint-3d witness
// Keyboard and mouse, reduced to named actions: held keys for movement, one-frame presses for
// entering cars, advancing dialogue and pausing, and the pointer in CSS pixels for aiming.
const ACTIONS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyF: 'enter', KeyE: 'enter',
  Space: 'confirm', Enter: 'confirm',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'map',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function act(code) {
    return ACTIONS[code] ?? null;
  }

  function onKeyDown(event) {
    const action = act(event.code);
    if (!action) return;
    if (event.code === 'Space' || event.code === 'Enter') event.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }

  function onKeyUp(event) {
    const action = act(event.code);
    if (action) held.delete(action);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    down(action) {
      return held.has(action);
    },
    pressed(action) {
      return pressed.has(action);
    },
    moveX() {
      return (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    },
    moveY() {
      return (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}