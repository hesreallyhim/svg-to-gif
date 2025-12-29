const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { runConversion } = require("../src/core");

const RUN_INTEGRATION = process.env.SVG_TO_GIF_RUN_INTEGRATION === "1";
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

function prepOutput(name) {
  const target = path.join(outDir, name);
  if (fs.existsSync(target)) {
    fs.rmSync(target);
  }
  return target;
}

function probeFormat(filePath) {
  const raw = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=format_name,duration",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(raw);
  return parsed.format || {};
}

(RUN_INTEGRATION ? test : test.skip)("converts static SVG to GIF", async () => {
  const input = path.join(__dirname, "fixtures", "static.svg");
  const out = prepOutput("out-static.gif");

  await runConversion({
    inputSvg: input,
    outputPath: out,
    duration: 1,
    fps: 5,
    width: 200,
    height: 100,
    scheme: "light",
    format: "gif",
    maxFrames: 2000,
    useGifsicle: false,
    scaleStrategy: "lanczos",
    palette: false,
    crf: null,
    totalFrames: 5,
  });

  expect(fs.existsSync(out)).toBe(true);
  expect(fs.statSync(out).size).toBeGreaterThan(50);
});

(RUN_INTEGRATION ? test : test.skip)("converts static SVG to MP4", async () => {
  const input = path.join(__dirname, "fixtures", "static.svg");
  const out = prepOutput("out-static.mp4");

  await runConversion({
    inputSvg: input,
    outputPath: out,
    duration: 1,
    fps: 5,
    width: 200,
    height: 100,
    scheme: "light",
    format: "mp4",
    maxFrames: 2000,
    useGifsicle: false,
    scaleStrategy: "lanczos",
    palette: false,
    crf: 20,
    totalFrames: 5,
  });

  expect(fs.existsSync(out)).toBe(true);
  expect(fs.statSync(out).size).toBeGreaterThan(200);
  const meta = probeFormat(out);
  expect((meta.format_name || "").includes("mp4")).toBe(true);
  const dur = parseFloat(meta.duration);
  expect(dur).toBeGreaterThan(0.5);
  expect(dur).toBeLessThan(1.5);
});

(RUN_INTEGRATION ? test : test.skip)("converts static SVG to WebM", async () => {
  const input = path.join(__dirname, "fixtures", "static.svg");
  const out = prepOutput("out-static.webm");

  await runConversion({
    inputSvg: input,
    outputPath: out,
    duration: 1,
    fps: 5,
    width: 200,
    height: 100,
    scheme: "light",
    format: "webm",
    maxFrames: 2000,
    useGifsicle: false,
    scaleStrategy: "lanczos",
    palette: false,
    crf: 30,
    totalFrames: 5,
  });

  expect(fs.existsSync(out)).toBe(true);
  expect(fs.statSync(out).size).toBeGreaterThan(200);
  const meta = probeFormat(out);
  expect(
    (meta.format_name || "").includes("webm") ||
      (meta.format_name || "").includes("matroska"),
  ).toBe(true);
  const dur = parseFloat(meta.duration);
  expect(dur).toBeGreaterThan(0.5);
  expect(dur).toBeLessThan(1.5);
});
