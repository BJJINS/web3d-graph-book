<template>
  <div ref="containerEl" class="monaco-container"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import loader from "@monaco-editor/loader";
import type * as MonacoType from "monaco-editor";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    language: string;
    theme?: string;
  }>(),
  {
    theme: "vs-dark",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const containerEl = ref<HTMLDivElement | null>(null);

let monaco: typeof MonacoType | null = null;
let editor: MonacoType.editor.IStandaloneCodeEditor | null = null;
let model: MonacoType.editor.ITextModel | null = null;
let disposeChange: MonacoType.IDisposable | null = null;

const createEditor = async () => {
  const el = containerEl.value;
  if (!el) return;

  monaco = await loader.init();
  const m = monaco;
  if (!m) return;

  model = m.editor.createModel(props.modelValue, props.language);

  editor = m.editor.create(el, {
    model,
    theme: props.theme,
    tabSize: 2,
    insertSpaces: true,
    lineNumbers: "on",
    glyphMargin: false,
    folding: true,
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: "on",
  });

  disposeChange = editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() ?? "";
    emit("update:modelValue", value);
  });
};

onMounted(() => {
  void createEditor();
});

watch(
  () => props.language,
  (lang) => {
    if (!monaco || !model) return;
    monaco.editor.setModelLanguage(model, lang);
  },
);

watch(
  () => props.theme,
  (theme) => {
    if (!monaco) return;
    monaco.editor.setTheme(theme || "vs-dark");
  },
);

watch(
  () => props.modelValue,
  (value) => {
    if (!editor) return;
    const current = editor.getValue();
    if (value !== current) {
      editor.setValue(value);
    }
  },
);

onBeforeUnmount(() => {
  disposeChange?.dispose();
  editor?.dispose();
  model?.dispose();
});
</script>

<style scoped>
.monaco-container {
  width: 100%;
  height: 500px;
}

@media (max-width: 960px) {
  .monaco-container {
    height: 300px;
  }
}
</style>
