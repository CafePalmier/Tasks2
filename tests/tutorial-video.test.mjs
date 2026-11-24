import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  prepareTutorialFile, TutorialMediaSizeError, tutorialVideoHint
} from '../tutorial-video.mjs';

test('video guidance uses measured duration and explains when compression must succeed', () => {
  assert.match(tutorialVideoHint({ size: 4_000_000 }, 20), /4\.0 MB · 20 seconds.*15–45 seconds/);
  assert.match(tutorialVideoHint({ size: 8_000_000 }, 65), /65 seconds.*Split longer walkthroughs into slides/);
  assert.match(tutorialVideoHint({ size: 53_000_000 }), /exceeds 50 MB/);
});

test('small videos and images are kept as uploaded', async () => {
  for (const file of [{ type: 'video/mp4', size: 4_000_000 }, { type: 'image/jpeg', size: 10_000_000 }]) {
    assert.equal(await prepareTutorialFile(file), file);
  }
});

test('browsers without encoding keep eligible originals and give oversized clips a trim instruction', async t => {
  const globals = Object.getOwnPropertyDescriptors(globalThis);
  Object.defineProperty(globalThis, 'VideoEncoder', { value: undefined, configurable: true });
  t.after(() => {
    if (globals.VideoEncoder) Object.defineProperty(globalThis, 'VideoEncoder', globals.VideoEncoder);
    else delete globalThis.VideoEncoder;
  });
  const file = { type: 'video/quicktime', size: 50_000_000 };
  assert.equal(await prepareTutorialFile(file), file);
  await assert.rejects(prepareTutorialFile({ ...file, size: file.size + 1 }),
    { name: 'Error', message: /over 50 MB.*Trim the clip/ });
  await assert.rejects(prepareTutorialFile({ type: 'image/png', size: file.size + 1 }), TutorialMediaSizeError);
});
