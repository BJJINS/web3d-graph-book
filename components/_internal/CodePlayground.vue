<template>
  <div class="wgp-root">
    <div class="wgp-toolbar">
      <button class="wgp-btn" type="button" @click="run">更新预览</button>
      <button class="wgp-btn" type="button" @click="openInNewTab">
        新标签页打开
      </button>
    </div>

    <div>
      <div class="wgp-editor">
        <div :class="['wgp-tabs', { 'wgp-tabs-light': !isDark }]">
          <button class="wgp-tab" :class="{ active: activeTab === 'html' }" type="button" @click="activeTab = 'html'">
            HTML
          </button>
          <button class="wgp-tab" :class="{ active: activeTab === 'css' }" type="button" @click="activeTab = 'css'">
            CSS
          </button>
          <button class="wgp-tab" :class="{ active: activeTab === 'js' }" type="button" @click="activeTab = 'js'">
            JS
          </button>
        </div>

        <MonacoEditor v-if="activeTab === 'html'" v-model="html" language="html" class="wgp-monaco"
          :theme="monacoTheme" />
        <MonacoEditor v-else-if="activeTab === 'css'" v-model="css" language="css" class="wgp-monaco"
          :theme="monacoTheme" />
        <MonacoEditor v-else v-model="js" language="javascript" class="wgp-monaco" :theme="monacoTheme" />
      </div>

      <div class="wgp-editor-preview-wrapper">
        <iframe ref="iframeEl" class="wgp-iframe" sandbox="allow-scripts allow-same-origin"></iframe>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useData } from "vitepress";
import { computed, onMounted, ref } from "vue";
import MonacoEditor from "./MonacoEditor.vue";

const props = defineProps({
  html: {
    type: String,
    default: "",
  },
  css: {
    type: String,
    default: "",
  },
  js: {
    type: String,
    default: "",
  },
});
const { isDark } = useData();

type Tab = "html" | "css" | "js";

const activeTab = ref<Tab>("js");
const html = ref(props.html);
const css = ref(props.css);
const js = ref(props.js);
const iframeEl = ref<HTMLIFrameElement | null>(null);

const monacoTheme = computed(() => (isDark.value ? "vs-dark" : "vs"));

const buildSrcDoc = () => {
  let doc = `<!doctype html>
  <html>
    <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css.value}</style>
    </head>
    <body>
    ${htmlBodyOnly(html.value)}
    <script type="module">
      ${js.value}
    ${"</scr"}${"ipt>"}
    </body>
  </html>
  `;

  return doc;
};

const run = () => {
  const iframe = iframeEl.value;
  if (!iframe) return;

  iframe.srcdoc = buildSrcDoc();
};

const openInNewTab = () => {
  const doc = buildSrcDoc();
  const blob = new Blob([doc], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

const htmlBodyOnly = (fullHtml: string) => {
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) return bodyMatch[1];
  return fullHtml;
};

onMounted(() => {
  run();
});
</script>

<style scoped>
.wgp-root {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  overflow: hidden;
}

.wgp-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.55);
}

.wgp-btn {
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.55);
  color: rgba(226, 232, 240, 0.95);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
}

.wgp-btn:hover {
  background: rgba(30, 41, 59, 0.8);
}

.wgp-editor {
  min-width: 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}

.wgp-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 8px 0;
  margin-bottom: 8px;
}

.wgp-tabs-light>.wgp-tab {
  background: rgba(226, 232, 240, 0.35);
  color: rgba(2, 6, 23, 0.9);
}

.wgp-tab {
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.35);
  color: rgba(226, 232, 240, 0.9);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}

.wgp-tab.active {
  background: rgba(99, 102, 241, 0.25);
  border-color: rgba(99, 102, 241, 0.55);
}

.wgp-monaco {
  overflow: hidden;
}

.wgp-iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.wgp-root:deep(.monaco-editor),
.wgp-root:deep(.monaco-editor-background),
.wgp-root:deep(.margin) {
  background: transparent !important;
}

.wgp-editor-preview-wrapper {
  height: 300px;
}

@media (max-width: 960px) {
  .wgp-editor-preview-wrapper {
    height: 200px;
  }
}
</style>
