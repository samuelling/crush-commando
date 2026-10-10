// Address of the multiplayer server (a Cloudflare Worker, deployed by .github/workflows/deploy.yml).
// The local dev server (node server/dev.js) serves its own copy pointing at itself.
// Set it to '' to play solo.
window.MP_SERVER = window.MP_SERVER || 'wss://crush-commando-mp.samuelling.workers.dev';
