<template>
  <CodePlayground :html="DEFAULT_HTML" :css="DEFAULT_CSS" :js="DEFAULT_JS" />
</template>

<script setup lang="ts">
import CodePlayground from "./_internal/CodePlayground.vue";

const DEFAULT_HTML = `<!DOCTYPE html>
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

const DEFAULT_CSS = "";

const DEFAULT_JS = `if (!navigator.gpu) {
  throw Error("WebGPU not supported.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw Error("Couldn't request WebGPU adapter.");
}

const device = await adapter.requestDevice();
if (!device) {
  throw new Error("need a browser that supports WebGPU");
}

const canvas = document.querySelector("canvas");
const context = canvas.getContext("webgpu");
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format: presentationFormat,
});

const module = device.createShaderModule({
  label: "triangle shader module",
  code:  \`
        @vertex
        fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
            let positions = array(
                vec4f(0.0, 0.5, 0.0, 1.0),
                vec4f(-0.5, -0.5, 0.0, 1.0),
                vec4f(0.5, -0.5, 0.0, 1.0),
            );
            return positions[vertexIndex];
        }

        @fragment
        fn fs() -> @location(0) vec4f {
            return vec4f(1.0, 0.0, 0.0, 1.0);
        }
    \`
});

const pipeline = device.createRenderPipeline({
  label: "triangle pipeline",
  layout: "auto",
  vertex: {
    module,
    entryPoint: "vs",
  },
  fragment: {
    module,
    entryPoint: "fs",
    targets: [{ format: presentationFormat }],
  },
  primitive: { topology: "triangle-list" },
});

const commandEncoder = device.createCommandEncoder();
const passEncoder = commandEncoder.beginRenderPass({
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      clearValue: { r: 0, g: 1, b: 0, a: 1 },
      storeOp: "store",
    },
  ],
});
passEncoder.setPipeline(pipeline);
passEncoder.draw(3);
passEncoder.end();
const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);`;
</script>
