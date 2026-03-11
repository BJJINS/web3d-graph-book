<template>
  <CodePlayground :html="DEFAULT_HTML" :css="DEFAULT_CSS" :js="DEFAULT_JS" />
</template>

<script setup lang="ts">
import CodePlayground from "./_internal/CodePlayground.vue";

import {
  DEFAULT_WEBGPU_CSS,
  DEFAULT_WEBGPU_HTML,
  DEFAULT_WEBGPU_SETUP_JS,
} from "./_internal/webgpuPlaygroundDefaults";

const DEFAULT_HTML = DEFAULT_WEBGPU_HTML;

const DEFAULT_CSS = DEFAULT_WEBGPU_CSS;

const DEFAULT_JS = `${DEFAULT_WEBGPU_SETUP_JS}

const vertexData = new Float32Array([
  0.0, 0.5,
  -0.5, -0.5,
  0.5, -0.5,
]);

const vertexBuffer = device.createBuffer({
  label: "triangle vertex buffer",
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, 0, vertexData);

const module = device.createShaderModule({
  label: "vertex buffer shader module",
  code: \`
        @vertex
        fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f {
            return vec4f(position, 0.0, 1.0);
        }

        @fragment
        fn fs() -> @location(0) vec4f {
            return vec4f(1.0, 0.0, 0.0, 1.0);
        }
    \`
});

const pipeline = device.createRenderPipeline({
  label: "triangle pipeline (vertex buffer)",
  layout: "auto",
  vertex: {
    module,
    entryPoint: "vs",
    buffers: [
      {
        arrayStride: 2 * 4,
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: "float32x2",
          },
        ],
      },
    ],
  },
  fragment: {
    module,
    entryPoint: "fs",
    targets: [{ format: presentationFormat }],
  },
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
passEncoder.setVertexBuffer(0, vertexBuffer);
passEncoder.draw(3);
passEncoder.end();
const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);`;
</script>
