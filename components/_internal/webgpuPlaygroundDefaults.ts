export const DEFAULT_WEBGPU_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebGPU Playground</title>
  </head>
  <body>
    <canvas height="150" width="300"></canvas>
  </body>
</html>`;

export const DEFAULT_WEBGPU_CSS = "";

export const DEFAULT_WEBGPU_SETUP_JS = `if (!navigator.gpu) {
  throw Error("WebGPU not supported.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw Error("Couldn't request WebGPU adapter.");
}

const device = await adapter.requestDevice();
if (!device) {
  throw Error("Couldn't request WebGPU device.");
}

const canvas = document.querySelector("canvas");
const context = canvas.getContext("webgpu");
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format: presentationFormat,
});`;
