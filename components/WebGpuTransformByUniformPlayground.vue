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

const uniformData = new Float32Array([
  0.25, 0.15, // offset.x, offset.y
  0.75, 0.0,  // scale, padding
]);

const uniformBuffer = device.createBuffer({
  label: "triangle transform uniform buffer",
  size: uniformData.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(uniformBuffer, 0, uniformData);

const module = device.createShaderModule({
  label: "uniform transform shader module",
  code: \`
    struct TransformUniform {
      offset: vec2f,
      scale: f32,
      _padding: f32,
    };

    @group(0) @binding(0) var<uniform> transform: TransformUniform;

    @vertex
    fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f {
      let moved = position * transform.scale + transform.offset;
      return vec4f(moved, 0.0, 1.0);
    }

    @fragment
    fn fs() -> @location(0) vec4f {
      return vec4f(1.0, 0.3, 0.2, 1.0);
    }
  \`,
});

const pipeline = device.createRenderPipeline({
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

const bindGroupLayout = pipeline.getBindGroupLayout(0);
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    {
      binding: 0,
      resource: { buffer: uniformBuffer },
    },
  ],
});

const commandEncoder = device.createCommandEncoder();
const passEncoder = commandEncoder.beginRenderPass({
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      clearValue: { r: 0.08, g: 0.1, b: 0.14, a: 1 },
      storeOp: "store",
    },
  ],
});

passEncoder.setPipeline(pipeline);
passEncoder.setVertexBuffer(0, vertexBuffer);
passEncoder.setBindGroup(0, bindGroup);
passEncoder.draw(3);
passEncoder.end();

const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);`;
</script>
