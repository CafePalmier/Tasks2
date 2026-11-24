const FREE_FILE_LIMIT = 50_000_000;
const OPTIMIZE_ABOVE = 5_000_000;
const TARGET_VIDEO_BITRATE = 1_100_000;
const AUDIO_BITRATE_ALLOWANCE = 256_000;

export const formatMediaSize = bytes => `${(bytes / 1_000_000).toFixed(1)} MB`;

export function tutorialVideoHint(file, duration) {
  const length = Number.isFinite(duration) && duration > 0 ? ` · ${Math.ceil(duration)} seconds` : '';
  const tip = duration > 45
    ? 'Try one action per 15–45 second clip. Split longer walkthroughs into slides, or use a photo for a still step.'
    : 'Aim for one action per clip, around 15–45 seconds.';
  const sizeHint = file.size > FREE_FILE_LIMIT
    ? ' This exceeds 50 MB and can upload only if compression brings it under the limit.' : '';
  return `${formatMediaSize(file.size)}${length}. ${tip}${sizeHint}`;
}

export class TutorialMediaSizeError extends Error {}

export async function prepareTutorialFile(file, onProgress) {
  if (file.type.startsWith('video/') && file.size > OPTIMIZE_ABOVE &&
      typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined') {
    try {
      const smaller = await compressVideo(file, onProgress);
      if (smaller && smaller.size < file.size && smaller.size <= FREE_FILE_LIMIT) return smaller;
    } catch (error) {
      console.warn('Could not compress the tutorial video on this device.', error);
    }
  }
  if (file.size <= FREE_FILE_LIMIT) return file;

  const tip = file.type.startsWith('video/')
    ? 'Trim the clip or split it into shorter slides and try again.' : 'Choose or export a smaller image.';
  throw new TutorialMediaSizeError(`The file for this slide is still over 50 MB. ${tip}`);
}

async function compressVideo(file, onProgress) {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality } =
    await import('./vendor/mediabunny-1.66.4.min.mjs');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) return null;
    const [width, height, duration] = await Promise.all([
      video.getDisplayWidth(), video.getDisplayHeight(), input.getDurationFromMetadata()
    ]);
    if (width < 2 || height < 2) return null;
    // Leave headroom for the container and audio when bringing large clips under the upload limit.
    const bitrate = file.size > FREE_FILE_LIMIT && duration > 0
      ? Math.min(TARGET_VIDEO_BITRATE, Math.floor(42_000_000 * 8 / duration) - AUDIO_BITRATE_ALLOWANCE)
      : TARGET_VIDEO_BITRATE;
    if (bitrate < 650_000) return null;

    const scale = Math.min(1, 1280 / Math.max(width, height), 720 / Math.min(width, height));
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input, output, showWarnings: false,
      video: {
        codec: 'avc', quality: new Quality({ bitrate }),
        width: Math.max(2, Math.floor(width * scale / 2) * 2),
        height: Math.max(2, Math.floor(height * scale / 2) * 2),
        fit: 'contain', allowTransformationMetadata: false
      },
      audio: { codec: 'aac' }
    });
    // If any track would be lost, use the original instead of dropping sound or other content.
    if (!conversion.isValid || conversion.discardedTracks.length) return null;
    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();
    const bytes = output.target.buffer;
    return bytes?.byteLength ? new File([bytes], 'tutorial.mp4', { type: 'video/mp4' }) : null;
  } finally {
    input.dispose();
  }
}
