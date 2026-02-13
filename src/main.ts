import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

import { setStatus, withTimeout } from './utils';
import { createSimulatorControls } from './simulator';
import { EvenRedditClient } from './even-client';

async function main() {
  setStatus('Waiting for Even bridge…');

  let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>> | null = null;
  try {
    bridge = await withTimeout(waitForEvenAppBridge(), 2500, 'waitForEvenAppBridge');
  } catch (e) {
    console.warn('Bridge not available, switching to browser mode', e);
  }

  if (bridge) {
    try {
      setStatus('Bridge found. Initializing glasses UI…');

      const client = new EvenRedditClient(bridge);
      await client.init();
      setStatus('Running. Use glasses controls to select items.');
      createSimulatorControls(client);
      return;
    } catch (e) {
      console.warn('Glasses UI init failed', e);
    }
  }

  setStatus('Bridge not available. Event monitor only.');
}

main().catch((e) => {
  console.error(e);
  setStatus(String(e));
});
