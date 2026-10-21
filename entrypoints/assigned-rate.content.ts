import { installAssignedRateHook } from '../lib/assigned-rate';

// Page scripts set playbackRate on this world's prototype. The isolated content
// script cannot see that setter, and ratechange arrives only after it settles.
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_start',
  world: 'MAIN',
  noScriptStartedPostMessage: true,
  main() {
    installAssignedRateHook(window);
  },
});
