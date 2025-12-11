const fs = require("fs");
const path = require("path");
const os = require("os");
const puppeteer = require("puppeteer");
const { execFileSync, spawnSync } = require("child_process");
const { buildFfmpegArgs } = require("./ffmpeg");
const presets = require("./presets");

const DEFAULTS = {
  duration: 4,
  fps: 30,
  width: 0,              // 0 => native
  height: 0,             // 0 => auto from SVG aspect
  scheme: "light",
  format: "gif",
  maxFrames: 2000,
  useGifsicle: true,
  scaleStrategy: "lanczos",
  palette: false,
  crf: null,
};

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length < 2) {
    throw new Error("Usage: svg-to-gif input.svg output.(gif|webm|mp4) [options]");
  }

  const inputSvg = path.resolve(args[0]);
  const outputPath = path.resolve(args[1]);

  const options = {
    duration: undefined,
    fps: undefined,
    width: undefined,
    height: undefined,
    scheme: undefined,
    format: undefined,
    maxFrames: undefined,
    useGifsicle: undefined,
    scaleStrategy: undefined,
    palette: undefined,
    crf: undefined,
    preset: undefined,
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--duration" && next) {
      options.duration = parseFloat(next);
      i++;
    } else if (arg === "--fps" && next) {
      options.fps = parseInt(next, 10);
      i++;
    } else if (arg === "--width" && next) {
      options.width = parseInt(next, 10);
      i++;
    } else if (arg === "--height" && next) {
      options.height = parseInt(next, 10);
      i++;
    } else if (arg === "--scheme" && next) {
      options.scheme = next;
      i++;
    } else if (arg === "--format" && next) {
      options.format = next.toLowerCase();
      i++;
    } else if (arg === "--max-frames" && next) {
      options.maxFrames = parseInt(next, 10);
      i++;
    } else if (arg === "--no-gifsicle") {
      options.useGifsicle = false;
    } else if (arg === "--scale-strategy" && next) {
      options.scaleStrategy = next.toLowerCase();
      i++;
    } else if (arg === "--palette") {
      options.palette = true;
    } else if (arg === "--no-palette") {
      options.palette = false;
    } else if (arg === "--crf" && next) {
      options.crf = parseInt(next, 10);
      i++;
    } else if (arg === "--preset" && next) {
      options.preset = next.toLowerCase();
      i++;
    }
  }

  return { inputSvg, outputPath, options };
}

function loadConfig(cwd) {
  const configPath = path.join(cwd, "svg-to-gif.config.json");
  if (!fs.existsSync(configPath)) {return {};}
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Warning: failed to parse svg-to-gif.config.json:", e.message || e);
    return {};
  }
}

function mergeOptions(config, cliOptions) {
  let merged = { ...DEFAULTS, ...config };

  if (cliOptions.preset && presets[cliOptions.preset]) {
    merged = { ...merged, ...presets[cliOptions.preset] };
  }

  const keys = [
    "duration",
    "fps",
    "width",
    "height",
    "scheme",
    "format",
    "maxFrames",
    "scaleStrategy",
    "palette",
    "crf",
  ];
  for (const key of keys) {
    if (cliOptions[key] !== undefined && cliOptions[key] !== null) {
      merged[key] = cliOptions[key];
    }
  }

  if (typeof cliOptions.useGifsicle === "boolean") {
    merged.useGifsicle = cliOptions.useGifsicle;
  }

  return merged;
}

function validateOptions(opts) {
  let {
    duration,
    fps,
    width,
    height,
    scheme,
    format,
    maxFrames,
    useGifsicle,
    scaleStrategy,
    palette,
    crf,
  } = opts;

  if (!(duration > 0 && duration <= 60)) {
    throw new Error("duration must be within (0, 60] seconds");
  }
  if (!(Number.isInteger(fps) && fps >= 1 && fps <= 60)) {
    throw new Error("fps must be an integer between 1 and 60");
  }

  const hasWidth = typeof width === "number" && width > 0;
  const hasHeight = typeof height === "number" && height > 0;

  if (hasWidth && (width < 16 || width > 4096)) {
    throw new Error("width must be between 16 and 4096 when explicitly set");
  }
  if (hasHeight && (height < 16 || height > 4096)) {
    throw new Error("height must be between 16 and 4096 when explicitly set");
  }

  if (!["light", "dark"].includes(scheme)) {
    throw new Error('scheme must be "light" or "dark"');
  }
  if (!["gif", "webm", "mp4"].includes(format)) {
    throw new Error('format must be one of "gif", "webm", "mp4"');
  }
  if (!["lanczos", "bilinear", "neighbor"].includes(scaleStrategy)) {
    throw new Error('scaleStrategy must be one of "lanczos", "bilinear", "neighbor"');
  }

  const totalFrames = Math.round(duration * fps);
  const max = typeof maxFrames === "number" && maxFrames > 0 ? maxFrames : DEFAULTS.maxFrames;
  if (totalFrames > max) {
    throw new Error(`duration * fps yields ${totalFrames} frames; max is ${max}`);
  }

  const paletteForGif = format === "gif" && !!palette;
  let usedCrf = null;
  if (format === "mp4") {
    usedCrf = typeof crf === "number" ? crf : 18;
  } else if (format === "webm") {
    usedCrf = typeof crf === "number" ? crf : 30;
  }

  return {
    duration,
    fps,
    width: hasWidth ? width : 0,
    height: hasHeight ? height : 0,
    scheme,
    format,
    maxFrames: max,
    useGifsicle: !!useGifsicle,
    scaleStrategy,
    palette: paletteForGif,
    crf: usedCrf,
    totalFrames,
  };
}

function hasGifsicle() {
  const res = spawnSync("gifsicle", ["--version"], { encoding: "utf8" });
  return res.status === 0;
}

async function runConversion(params) {
  const {
    inputSvg,
    outputPath,
    duration,
    fps,
    width,
    height,
    scheme,
    format,
    totalFrames,
    useGifsicle,
    scaleStrategy,
    palette,
    crf,
  } = params;

  if (!fs.existsSync(inputSvg)) {
    throw new Error(`Input SVG does not exist: ${inputSvg}`);
  }

  const svgMarkup = fs.readFileSync(inputSvg, "utf8");
  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), "svg-to-gif-"));

  console.error("Input:", inputSvg);
  console.error("Output:", outputPath);
  console.error(`Format: ${format}, Duration: ${duration}s, FPS: ${fps}, Frames: ${totalFrames}`);
  console.error(`Viewport width: ${width || "native"}, height: ${height || "auto"}`);
  console.error(`Color scheme: ${scheme}`);
  console.error(`Scale strategy: ${scaleStrategy}`);
  console.error(`Palette mode: ${palette && format === "gif"}`);
  console.error(`Frames dir: ${framesDir}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    await page.setViewport({
      width: width && width > 0 ? width : 720,
      height: height && height > 0 ? height : 600,
      deviceScaleFactor: 1,
    });

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${scheme === "dark" ? "#000000" : "#ffffff"};
    }
    svg { max-width: 100%; max-height: 100%; display: block; }
  </style>
</head>
<body>
${svgMarkup}
</body>
</html>`;

    await page.setContent(html, { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const startFrames = Date.now();
    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;

      await page.evaluate((timeSec) => {
        const svg = document.querySelector("svg");
        if (svg && typeof svg.setCurrentTime === "function") {
          try {
            svg.setCurrentTime(timeSec);
          } catch {
            // Ignore errors from setCurrentTime - not all SVGs support this method
          }
        }
      }, t);

      const framePath = path.join(framesDir, `frame_${String(i).padStart(4, "0")}.png`);
      await page.screenshot({ path: framePath });

      if (i === 0 || i === totalFrames - 1 || i % Math.max(1, Math.floor(totalFrames / 10)) === 0) {
        const pct = Math.round(((i + 1) / totalFrames) * 100);
        console.error(`Frames: ${i + 1}/${totalFrames} (${pct}%)`);
      }
    }
    const frameElapsed = ((Date.now() - startFrames) / 1000).toFixed(2);
    console.error(`Frame capture done in ${frameElapsed}s`);

    const inputPattern = path.join(framesDir, "frame_%04d.png");

    if (format === "gif" && palette) {
      // Palette-based GIF pipeline
      const palettePath = path.join(framesDir, "palette.png");

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

      const scaleFilter = filters.join(",");

      const paletteGenArgs = [
        "-y",
        "-framerate", String(fps),
        "-i", inputPattern,
      ];
      if (scaleFilter) {
        paletteGenArgs.push("-vf", `${scaleFilter},palettegen`);
      } else {
        paletteGenArgs.push("-vf", "palettegen");
      }
      paletteGenArgs.push(palettePath);

      console.error("Running ffmpeg palettegen", paletteGenArgs.join(" "));
      execFileSync("ffmpeg", paletteGenArgs, { stdio: "inherit" });

      const paletteUseArgs = [
        "-y",
        "-framerate", String(fps),
        "-i", inputPattern,
        "-i", palettePath,
      ];
      if (scaleFilter) {
        paletteUseArgs.push("-lavfi", `${scaleFilter},paletteuse`);
      } else {
        paletteUseArgs.push("-lavfi", "paletteuse");
      }
      paletteUseArgs.push("-loop", "0", outputPath);

      console.error("Running ffmpeg paletteuse", paletteUseArgs.join(" "));
      execFileSync("ffmpeg", paletteUseArgs, { stdio: "inherit" });
    } else {
      const ffmpegArgs = buildFfmpegArgs(framesDir, outputPath, {
        fps,
        width,
        height,
        format,
        scaleStrategy,
        crf,
      });
      console.error("Running ffmpeg", ffmpegArgs.join(" "));
      execFileSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
    }

    if (format === "gif" && useGifsicle && hasGifsicle()) {
      console.error("Running gifsicle optimization...");
      const tmpOptimized = outputPath + ".tmp.gif";
      execFileSync("gifsicle", ["-O3", outputPath, "-o", tmpOptimized], {
        stdio: "inherit",
      });
      fs.renameSync(tmpOptimized, outputPath);
      console.error("gifsicle optimization complete");
    } else if (format === "gif" && useGifsicle) {
      console.error("gifsicle not found; skipping optimization");
    }
  } finally {
    await browser.close();
    try {
      fs.rmSync(framesDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors - temp directory may already be deleted
    }
  }
}

module.exports = {
  DEFAULTS,
  parseArgs,
  loadConfig,
  mergeOptions,
  validateOptions,
  hasGifsicle,
  runConversion,
};
