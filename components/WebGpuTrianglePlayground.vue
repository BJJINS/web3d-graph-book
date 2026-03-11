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
