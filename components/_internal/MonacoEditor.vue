<template>
    <div ref="containerEl" class="monaco-container"></div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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

let editor: MonacoType.editor.IStandaloneCodeEditor | null = null;
let model: MonacoType.editor.ITextModel | null = null;
let disposeChange: MonacoType.IDisposable | null = null;
let resizeObserver: ResizeObserver | null = null;
let monaco: typeof MonacoType | null = null;
let nextModelId = 0;
let monacoPromise: Promise<typeof MonacoType> | null = null;

declare global {
    var MonacoEnvironment:
        | {
              getWorker?: (_workerId: string, label: string) => Worker;
          }
        | undefined;
}

const ensureMonaco = async () => {
    if (monaco) return monaco;
    if (!monacoPromise) {
        monacoPromise = Promise.all([
            import("monaco-editor"),
            import("monaco-editor/esm/vs/editor/editor.worker?worker"),
            import("monaco-editor/esm/vs/language/css/css.worker?worker"),
            import("monaco-editor/esm/vs/language/html/html.worker?worker"),
            import("monaco-editor/esm/vs/language/typescript/ts.worker?worker"),
        ]).then(
            ([
                monacoModule,
                editorWorkerModule,
                cssWorkerModule,
                htmlWorkerModule,
                tsWorkerModule,
            ]) => {
                if (!globalThis.MonacoEnvironment) {
                    globalThis.MonacoEnvironment = {
                        getWorker(_workerId, label) {
                            switch (label) {
                                case "css":
                                case "less":
                                case "scss":
                                    return new cssWorkerModule.default();
                                case "html":
                                case "handlebars":
                                case "razor":
                                    return new htmlWorkerModule.default();
                                case "javascript":
                                case "typescript":
                                    return new tsWorkerModule.default();
                                default:
                                    return new editorWorkerModule.default();
                            }
                        },
                    };
                }

                monaco = monacoModule;
                return monacoModule;
            },
        );
    }

    return monacoPromise;
};

const getModelExtension = (language: string) => {
    switch (language) {
        case "javascript":
            return "js";
        case "typescript":
            return "ts";
        case "html":
            return "html";
        case "css":
            return "css";
        default:
            return "txt";
    }
};

const createEditor = async () => {
    const el = containerEl.value;
    if (!el || editor) return;

    await nextTick();
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });

    const m = await ensureMonaco();
    const uri = m.Uri.parse(
        `inmemory://code-playground/${++nextModelId}.${getModelExtension(props.language)}`,
    );

    model = m.editor.createModel(props.modelValue ?? "", props.language, uri);
    m.editor.setTheme(props.theme || "vs-dark");

    editor = m.editor.create(el, {
        model,
        theme: props.theme,
        tabSize: 2,
        insertSpaces: true,
        lineNumbers: "on",
        glyphMargin: false,
        folding: true,
        fontSize: 11,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
    });

    disposeChange = editor.onDidChangeModelContent(() => {
        const value = editor?.getValue() ?? "";
        emit("update:modelValue", value);
    });

    resizeObserver = new ResizeObserver(() => {
        editor?.layout();
    });
    resizeObserver.observe(el);
    editor.layout();
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
        if (!model) return;
        const current = model.getValue();
        if (value !== current) {
            model.setValue(value);
        }
    },
);

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
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
