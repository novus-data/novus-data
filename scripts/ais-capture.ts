/**
 * `npm run ais:capture` — record raw AISStream messages, so the real message
 * shape can be checked by a person.
 *
 *   npm run ais:capture                listen 60 seconds
 *   npm run ais:capture -- --seconds 120
 *
 * WHY THIS EXISTS
 *
 * The per-vessel layer (src/lib/live/sources/ais.ts) was written against
 * AISStream's published OpenAPI schema, in an environment that could not
 * reach AISStream. The schema leaves `MetaData` untyped, so some things are
 * assumptions until a real message is read: whether a static message's
 * MetaData carries a position, how `time_utc` is written on static messages,
 * and whether `Valid` is ever false. Run this anywhere the network is open,
 * with the key in .env.local, and send the file to whoever is checking.
 *
 * WHAT IT WRITES, AND WHERE
 *
 * Up to 200 raw messages of each subscribed type, to .ais-capture/, which is
 * git-ignored. Nothing from it is committed or published. The file holds
 * public radio broadcasts (names, positions); delete it once it has been read.
 *
 * It never prints the key, and does not echo AISStream's error text (which
 * could repeat it). It reads the same chokepoint boxes the site samples.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { blank, blocker, detail, info, loadEnvLocal, ok, warn } from './lib/cli';

const STREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const PER_TYPE = 200;
const OUT_DIR = '.ais-capture';

async function main(): Promise<void> {
  loadEnvLocal();
  const key = process.env.AISSTREAM_API_KEY?.trim();
  if (!key) {
    blocker('AISSTREAM_API_KEY is not set. Put it in .env.local (never in a commit or a chat). See DEPLOY.md Part 5.');
    process.exitCode = 1;
    return;
  }

  const flag = process.argv.indexOf('--seconds');
  const seconds = flag > 0 ? Number(process.argv[flag + 1]) : 60;
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 600) {
    blocker('--seconds must be between 5 and 600.');
    process.exitCode = 1;
    return;
  }

  const { CHOKEPOINTS } = await import('@/lib/live/nodes');
  const { AIS_SUBSCRIBED_MESSAGE_TYPES } = await import('@/lib/live/sources/ais');

  info('AISSTREAM_API_KEY is set.');
  info(`Listening for ${seconds} seconds at ${CHOKEPOINTS.length} chokepoint boxes…`);

  const byType = new Map<string, unknown[]>();
  const seen = new Map<string, number>();
  let refused = false;
  let failed: string | null = null;

  await new Promise<void>((resolve) => {
    const socket = new WebSocket(STREAM_URL);
    socket.binaryType = 'arraybuffer';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // Nothing to recover.
      }
      resolve();
    };

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          APIKey: key,
          BoundingBoxes: CHOKEPOINTS.flatMap((node) => (node.box ? [node.box] : [])),
          FilterMessageTypes: AIS_SUBSCRIBED_MESSAGE_TYPES,
        }),
      );
      timer = setTimeout(done, seconds * 1000);
    });
    socket.addEventListener('message', (event) => {
      const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
      let message: unknown;
      try {
        message = JSON.parse(text);
      } catch {
        return;
      }
      if (typeof message === 'object' && message !== null && 'error' in message) {
        refused = true;
        done();
        return;
      }
      const type =
        typeof message === 'object' && message !== null && typeof (message as { MessageType?: unknown }).MessageType === 'string'
          ? (message as { MessageType: string }).MessageType
          : '(no MessageType)';
      seen.set(type, (seen.get(type) ?? 0) + 1);
      const list = byType.get(type) ?? [];
      if (list.length < PER_TYPE) list.push(message);
      byType.set(type, list);
    });
    socket.addEventListener('error', () => {
      failed = 'The connection to AISStream failed.';
      done();
    });
    socket.addEventListener('close', () => done());
  });

  blank();
  if (refused) {
    blocker('AISStream refused the subscription. Check that AISSTREAM_API_KEY is valid (its reply is not printed).');
    process.exitCode = 1;
    return;
  }
  if (failed) warn(failed);

  for (const [type, count] of seen) detail(`${type}: ${count} received, ${Math.min(count, PER_TYPE)} kept`);
  if (seen.size === 0) {
    warn('No messages arrived. That usually points to the network or the service, not to empty sea lanes.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `capture-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        seconds,
        subscribed: AIS_SUBSCRIBED_MESSAGE_TYPES,
        received: Object.fromEntries(seen),
        messages: Object.fromEntries(byType),
      },
      null,
      2,
    ),
  );
  ok(`Wrote ${file} (git-ignored). Send it to whoever is checking the shape, then delete it.`);
  blank();
}

main().catch((error: unknown) => {
  console.error('ais:capture failed to run.');
  // A sentence of ours only: an error object here could carry the subscription.
  console.error(error instanceof Error ? error.name : 'Unknown error');
  process.exitCode = 1;
});
