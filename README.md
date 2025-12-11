# svg-to-gif

A small Node.js tool that converts SVG animations to GIF, WebM, or MP4 using headless Chromium (Puppeteer) and ffmpeg.

## Features

- Renders SVG in a real headless browser (Chromium) so SMIL / CSS / filters work.
- Exports **GIF**, **WebM (VP9)**, or **MP4 (H.264)**.
- Built-in **presets** for common use cases:
  - `crisp-ui` – sharp rectangles, logos, contribution grids.
  - `smooth` – fluid particle animations.
  - `pixel-art` – nearest-neighbor scaling for blocky art.
  - `hd-video` – high quality MP4 output.
- Optional palette-based GIF encoding for better color fidelity.
- Validated duration / fps / dimensions to avoid accidents.
- Optional `gifsicle` optimization (if installed).
- Optional `svg-to-gif.config.json` in the working directory for defaults.

## Install

```bash
# npm install -g svg-to-gif
```

## CLI

```bash
svg-to-gif input.svg output.(gif|webm|mp4) [options]

Options:
  --duration <seconds>        Animation duration (0 < d <= 60, default 4)
  --fps <n>                   Frames per second (1–60, preset-dependent)
  --width <px>                Output width in pixels (16–4096, default: native)
  --height <px>               Output height (16–4096, default: auto from SVG)
  --scheme <light|dark>       prefers-color-scheme emulation (default: light)
  --format <gif|webm|mp4>     Output format (default: gif)
  --preset <name>             One of: crisp-ui, smooth, pixel-art, hd-video
  --scale-strategy <k>        lanczos | bilinear | neighbor (advanced)
  --palette / --no-palette    Enable/disable palette-mode GIF encoding
  --crf <n>                   CRF for mp4/webm (e.g. 18 for mp4, 30 for webm)
  --no-gifsicle               Skip gifsicle optimization even if available
```

Config file (optional, values overridden by CLI flags):

```jsonc
// svg-to-gif.config.json
{
  "duration": 5,
  "fps": 24,
  "width": 800,
  "scheme": "dark",
  "format": "gif",
  "preset": "crisp-ui",
  "scaleStrategy": "neighbor",
  "palette": true,
  "maxFrames": 2000,
  "useGifsicle": true
}
```

## Tests

```bash
npm test
```
