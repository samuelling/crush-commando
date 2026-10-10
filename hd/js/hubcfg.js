// Settings for the combined "Crush Commando x Hollow Dash" page, kept free of imports so the level
// generator can read them without an import cycle. See hub.js.
const params = new URLSearchParams(location.search);
export const HUB = { on: params.has('hub') && window.parent !== window, asleep: false };

// Portal pairs: portal i links Crush Commando world i with a Hollow Dash chapter.
export const PORTAL_CH = [0, 1, 3, 6, 5];
export const CH_PORTAL = {};
PORTAL_CH.forEach((c, i) => { CH_PORTAL[c] = i; });
const CC_WORLDS = ['Recess Grove', 'Unsent Letter Caves', 'Left-on-Read Spires', 'Cold Shoulder Peaks', 'The Heartbreak Core'];
export const portalLabel = (id) => CC_WORLDS[id] || 'somewhere';

// The same chapter always generates the same road, so friends in the same stretch share one world.
export const hubSeed = (k) => 0x5eed + k * 7919;
