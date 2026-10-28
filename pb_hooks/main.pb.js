/// <reference path="../pb_data/types.d.ts" />

// SNES ROMs are small and served as whole files, so there is no streaming
// timeout to disable and no SharedArrayBuffer requirement in the default
// Nostalgist/RetroArch build. If a future core needs cross-origin isolation,
// add the COOP/COEP/CORP headers here.
routerUse((e) => {
  e.response.header().set('X-Content-Type-Options', 'nosniff');
  return e.next();
});
