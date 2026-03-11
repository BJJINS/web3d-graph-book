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

const vertexSize = 2 * 4 + 4;
const vertexData = new ArrayBuffer(vertexSize * 3);
const posView = new Float32Array(vertexData);
const colorView = new Uint8Array(vertexData);

const positions = [
  0.0, 0.5,
  -0.5, -0.5,
  0.5, -0.5,
];

const colors = [
  255, 0, 0, 255,
  0, 255, 0, 255,
  0, 0, 255, 255,
];

for (let i = 0; i < 3; i++) {
  posView[i * 3] = positions[i * 2];
  posView[i * 3 + 1] = positions[i * 2 + 1];
  const colorBase = i * vertexSize + 8;
  colorView[colorBase + 0] = colors[i * 4 + 0];
  colorView[colorBase + 1] = colors[i * 4 + 1];
  colorView[colorBase + 2] = colors[i * 4 + 2];
  colorView[colorBase + 3] = colors[i * 4 + 3];
}

const vertexBuffer = device.createBuffer({
  label: "triangle inter-stage vertex buffer",
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, 0, vertexData);

const module = device.createShaderModule({
  label: "inter-stage shader module",
  code: \`
    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(1) color: vec3f,
    };

    @vertex
    fn vs(@location(0) position: vec2f, @location(1) color: vec4f) -> VertexOutput {
      var output: VertexOutput;
      output.position = vec4f(position, 0.0, 1.0);
      output.color = color.rgb;
      return output;
    }

    @fragment
    fn fs(@location(1) color: vec3f) -> @location(0) vec4f {
      return vec4f(color, 1.0);
    }
  \`,
});

const pipeline = device.createRenderPipeline({
  label: "triangle pipeline (inter-stage)",
  layout: "auto",
  vertex: {
    module,
    entryPoint: "vs",
    buffers: [
      {
        arrayStride: vertexSize,
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: "float32x2",
          },
          {
            shaderLocation: 1,
            offset: 2 * 4,
            format: "unorm8x4",
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
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
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
