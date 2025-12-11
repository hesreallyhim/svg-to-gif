const path = require("path");

function buildFfmpegArgs(framesDir, outputPath, { fps, width, height, format, scaleStrategy, crf }) {
  const inputPattern = path.join(framesDir, "frame_%04d.png");

  const isGif = format === "gif";
  const isWebm = format === "webm";
  const isMp4 = format === "mp4";

  const hasWidth = typeof width === "number" && width > 0;
  const hasHeight = typeof height === "number" && height > 0;
  const shouldScale = hasWidth || hasHeight;

  let kernel = "lanczos";
  if (scaleStrategy === "neighbor") {kernel = "neighbor";}
  if (scaleStrategy === "bilinear") {kernel = "bilinear";}

  const filters = [];
  if (shouldScale) {
    const scaleW = hasWidth ? width : -1;
    const scaleH = hasHeight ? height : -1;
    filters.push(`scale=${scaleW}:${scaleH}:flags=${kernel}`);
  }

  const vfArgs = filters.length > 0 ? ["-vf", filters.join(",")] : [];

  const baseArgs = [
    "-y",
    "-framerate", String(fps),
    "-i", inputPattern,
  ];

  if (isGif) {
    return [
      ...baseArgs,
      ...vfArgs,
      "-loop", "0",
      outputPath,
    ];
  }

  if (isWebm) {
    const usedCrf = typeof crf === "number" ? crf : 30;
    return [
      ...baseArgs,
      ...vfArgs,
      "-c:v", "libvpx-vp9",
      "-b:v", "0",
      "-crf", String(usedCrf),
      "-pix_fmt", "yuva420p",
      outputPath,
    ];
  }

  if (isMp4) {
    const usedCrf = typeof crf === "number" ? crf : 18;
    return [
      ...baseArgs,
      ...vfArgs,
      "-c:v", "libx264",
      "-crf", String(usedCrf),
      "-preset", "slow",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ];
  }

  throw new Error(`Unsupported output format: ${format}`);
}

module.exports = { buildFfmpegArgs };
