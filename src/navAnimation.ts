export type TabAnim = 'slide_from_right' | 'slide_from_left';

// Module-level mutable so AppHeader can flip the next push/pop direction
// before calling navigate, and the Stack.Navigator's screenOptions can
// read it when computing the destination's animation.
let direction: TabAnim = 'slide_from_right';

export function getTabAnimationDirection(): TabAnim {
  return direction;
}

export function setTabAnimationDirection(d: TabAnim) {
  direction = d;
}
