<template>
    <div :class="['wgp-root', isDark ? 'wgp-root-dark' : 'wgp-root-light']">
        <div class="wgp-toolbar">
            <div class="wgp-toolbar-copy">
                <div class="wgp-toolbar-title">在线 Playground</div>
                <p class="wgp-toolbar-desc">
                    在同一处编辑 HTML、CSS 和 JS，并立即查看运行结果。
                </p>
            </div>

            <div class="wgp-toolbar-actions">
                <button class="wgp-btn wgp-btn-primary" type="button" @click="run">
                    更新预览
                </button>
                <button class="wgp-btn wgp-btn-secondary wgp-btn-desktop-only" type="button" @click="openModal">
                    弹窗模式
                </button>
                <button class="wgp-btn wgp-btn-secondary" type="button" @click="openInNewTab">
                    新标签页打开
                </button>
            </div>
        </div>

        <div class="wgp-workspace">
            <section class="wgp-panel wgp-editor-panel">
                <div class="wgp-panel-header">
                    <div>
                        <div class="wgp-panel-title">代码编辑区</div>
                        <div class="wgp-panel-subtitle">{{ activeTabLabel }}</div>
                    </div>

                    <div class="wgp-tabs">
                        <button
                            class="wgp-tab"
                            :class="{ active: activeTab === 'html' }"
                            type="button"
                            @click="activeTab = 'html'"
                        >
                            HTML
                        </button>
                        <button
                            class="wgp-tab"
                            :class="{ active: activeTab === 'css' }"
                            type="button"
                            @click="activeTab = 'css'"
                        >
                            CSS
                        </button>
                        <button
                            class="wgp-tab"
                            :class="{ active: activeTab === 'js' }"
                            type="button"
                            @click="activeTab = 'js'"
                        >
                            JS
                        </button>
                    </div>
                </div>

                <div class="wgp-editor-body">
                    <MonacoEditor
                        v-if="activeTab === 'html'"
                        v-model="html"
                        language="html"
                        class="wgp-monaco"
                        :theme="monacoTheme"
                    />
                    <MonacoEditor
                        v-else-if="activeTab === 'css'"
                        v-model="css"
                        language="css"
                        class="wgp-monaco"
                        :theme="monacoTheme"
                    />
                    <MonacoEditor
                        v-else
                        v-model="js"
                        language="javascript"
                        class="wgp-monaco"
                        :theme="monacoTheme"
                    />
                </div>
            </section>

            <section class="wgp-panel wgp-preview-panel">
                <div class="wgp-panel-header">
                    <div>
                        <div class="wgp-panel-title">预览结果</div>
                        <div class="wgp-panel-subtitle">点击“更新预览”后在右侧运行</div>
                    </div>
                </div>

                <div class="wgp-preview-body">
                    <iframe
                        ref="iframeEl"
                        class="wgp-iframe"
                        sandbox="allow-scripts allow-same-origin"
                    ></iframe>
                </div>
            </section>
        </div>
    </div>

    <Teleport to="body">
        <div v-if="isModalOpen" class="wgp-modal-backdrop" @click.self="closeModal">
            <div :class="['wgp-root', 'wgp-modal-shell', isDark ? 'wgp-root-dark' : 'wgp-root-light']">
                <div class="wgp-toolbar wgp-modal-toolbar">
                    <div class="wgp-toolbar-copy">
                        <div class="wgp-toolbar-title">在线 Playground（大窗模式）</div>
                        <p class="wgp-toolbar-desc">
                            在更大的编辑区域中修改代码，并立即查看运行结果。
                        </p>
                    </div>

                    <div class="wgp-toolbar-actions">
                        <button class="wgp-btn wgp-btn-primary" type="button" @click="run">
                            更新预览
                        </button>
                        <button class="wgp-btn wgp-btn-secondary" type="button" @click="openInNewTab">
                            新标签页打开
                        </button>
                        <button class="wgp-btn wgp-btn-secondary" type="button" @click="closeModal">
                            关闭
                        </button>
                    </div>
                </div>

                <div class="wgp-workspace wgp-workspace-modal">
                    <section class="wgp-panel wgp-editor-panel">
                        <div class="wgp-panel-header">
                            <div>
                                <div class="wgp-panel-title">代码编辑区</div>
                                <div class="wgp-panel-subtitle">{{ activeTabLabel }}</div>
                            </div>

                            <div class="wgp-tabs">
                                <button
                                    class="wgp-tab"
                                    :class="{ active: activeTab === 'html' }"
                                    type="button"
                                    @click="activeTab = 'html'"
                                >
                                    HTML
                                </button>
                                <button
                                    class="wgp-tab"
                                    :class="{ active: activeTab === 'css' }"
                                    type="button"
                                    @click="activeTab = 'css'"
                                >
                                    CSS
                                </button>
                                <button
                                    class="wgp-tab"
                                    :class="{ active: activeTab === 'js' }"
                                    type="button"
                                    @click="activeTab = 'js'"
                                >
                                    JS
                                </button>
                            </div>
                        </div>

                        <div class="wgp-editor-body">
                            <MonacoEditor
                                v-if="activeTab === 'html'"
                                v-model="html"
                                language="html"
                                class="wgp-monaco"
                                :theme="monacoTheme"
                            />
                            <MonacoEditor
                                v-else-if="activeTab === 'css'"
                                v-model="css"
                                language="css"
                                class="wgp-monaco"
                                :theme="monacoTheme"
                            />
                            <MonacoEditor
                                v-else
                                v-model="js"
                                language="javascript"
                                class="wgp-monaco"
                                :theme="monacoTheme"
                            />
                        </div>
                    </section>

                    <section class="wgp-panel wgp-preview-panel">
                        <div class="wgp-panel-header">
                            <div>
                                <div class="wgp-panel-title">预览结果</div>
                                <div class="wgp-panel-subtitle">点击“更新预览”后在右侧运行</div>
                            </div>
                        </div>

                        <div class="wgp-preview-body">
                            <iframe
                                ref="modalIframeEl"
                                class="wgp-iframe"
                                sandbox="allow-scripts allow-same-origin"
                            ></iframe>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { useData } from "vitepress";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
const modalIframeEl = ref<HTMLIFrameElement | null>(null);
const isModalOpen = ref(false);

const monacoTheme = computed(() => (isDark.value ? "vs-dark" : "vs"));
const activeTabLabel = computed(() => {
    const labels: Record<Tab, string> = {
        html: "结构与挂载节点",
        css: "样式与布局表现",
        js: "交互与运行逻辑",
    };
    return labels[activeTab.value];
});

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
      <\/script>
    </body>
  </html>
  `;

    return doc;
};

const writePreviewTo = (iframe: HTMLIFrameElement | null) => {
    if (!iframe) return;
    iframe.srcdoc = buildSrcDoc();
};

const run = () => {
    writePreviewTo(iframeEl.value);
    writePreviewTo(modalIframeEl.value);
};

const openModal = async () => {
    isModalOpen.value = true;
    await nextTick();
    writePreviewTo(modalIframeEl.value);
};

const closeModal = () => {
    isModalOpen.value = false;
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

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isModalOpen.value) {
        closeModal();
    }
};

onMounted(() => {
    run();
    window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeydown);
    if (typeof document !== "undefined") {
        document.body.style.overflow = "";
    }
});

watch(isModalOpen, (value) => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = value ? "hidden" : "";
});
</script>

<style scoped>
.wgp-root {
    --wgp-pane-height: 440px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 18px;
    padding: 16px;
    background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 32%),
        var(--vp-c-bg-soft);
    box-shadow:
        0 14px 36px rgba(15, 23, 42, 0.07),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.wgp-root-dark {
    background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.16), transparent 36%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.84));
}

.wgp-root-light {
    background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 32%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
}

.wgp-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
}

.wgp-toolbar-copy {
    min-width: 0;
}

.wgp-toolbar-title {
    font-size: 16px;
    line-height: 1.2;
    font-weight: 700;
    color: var(--vp-c-text-1);
    margin-bottom: 6px;
}

.wgp-toolbar-desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--vp-c-text-2);
}

.wgp-toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.wgp-btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    padding: 8px 14px;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    font-weight: 600;
    transition:
        transform 0.18s ease,
        background-color 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease;
}

.wgp-btn:hover {
    transform: translateY(-1px);
}

.wgp-btn-primary {
    border: 1px solid rgba(99, 102, 241, 0.55);
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.92), rgba(79, 70, 229, 0.92));
    color: #fff;
    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.16);
}

.wgp-btn-primary:hover {
    background: linear-gradient(180deg, rgba(99, 102, 241, 1), rgba(79, 70, 229, 1));
}

.wgp-btn-secondary {
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(148, 163, 184, 0.08);
    color: var(--vp-c-text-1);
}

.wgp-btn-secondary:hover {
    background: rgba(148, 163, 184, 0.14);
}

.wgp-btn-desktop-only {
    display: inline-flex;
}

.wgp-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    gap: 16px;
    align-items: stretch;
}

.wgp-panel {
    min-width: 0;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 16px;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(10px);
}

.wgp-root-light .wgp-panel {
    background: rgba(255, 255, 255, 0.78);
}

.wgp-root-dark .wgp-panel {
    background: rgba(2, 6, 23, 0.38);
}

.wgp-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.wgp-panel-title {
    font-size: 14px;
    line-height: 1.2;
    font-weight: 700;
    color: var(--vp-c-text-1);
    margin-bottom: 4px;
}

.wgp-panel-subtitle {
    font-size: 12px;
    line-height: 1.45;
    color: var(--vp-c-text-2);
}

.wgp-editor-body,
.wgp-preview-body {
    height: var(--wgp-pane-height);
}

.wgp-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding: 4px;
    border-radius: 12px;
    background: rgba(148, 163, 184, 0.1);
}

.wgp-tab {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: var(--vp-c-text-2);
    border-radius: 10px;
    padding: 7px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition:
        background-color 0.18s ease,
        border-color 0.18s ease,
        color 0.18s ease;
}

.wgp-tab.active {
    background: rgba(99, 102, 241, 0.16);
    border-color: rgba(99, 102, 241, 0.28);
    color: var(--vp-c-text-1);
}

.wgp-monaco {
    overflow: hidden;
    height: 100%;
}

.wgp-iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: #fff;
}

.wgp-editor-body :deep(.monaco-container) {
    height: var(--wgp-pane-height) !important;
}

.wgp-root:deep(.monaco-editor),
.wgp-root:deep(.monaco-editor-background),
.wgp-root:deep(.margin) {
    background: transparent !important;
}

.wgp-root:deep(.monaco-editor),
.wgp-root:deep(.monaco-editor-background),
.wgp-root:deep(.margin),
.wgp-root:deep(.monaco-editor .inputarea.ime-input) {
    background: transparent !important;
}

.wgp-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(2, 6, 23, 0.64);
    backdrop-filter: blur(8px);
}

.wgp-modal-shell {
    --wgp-pane-height: min(68vh, 760px);
    width: min(1400px, calc(100vw - 48px));
    max-height: calc(100vh - 48px);
    overflow: auto;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 22px;
    padding: 18px;
    box-shadow:
        0 24px 80px rgba(15, 23, 42, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.wgp-modal-toolbar {
    margin-bottom: 18px;
}

.wgp-workspace-modal {
    grid-template-columns: minmax(0, 1.2fr) minmax(420px, 0.8fr);
}

@media (max-width: 960px) {
    .wgp-root {
        --wgp-pane-height: 360px;
        padding: 14px;
    }

    .wgp-workspace {
        grid-template-columns: 1fr;
    }

    .wgp-btn-desktop-only {
        display: none;
    }
}

@media (max-width: 640px) {
    .wgp-root {
        --wgp-pane-height: 300px;
        padding: 12px;
        border-radius: 16px;
    }

    .wgp-panel-header {
        flex-direction: column;
    }

    .wgp-tabs {
        width: 100%;
    }

    .wgp-toolbar-actions {
        width: 100%;
    }

    .wgp-btn {
        flex: 1 1 auto;
        justify-content: center;
    }
}
</style>
