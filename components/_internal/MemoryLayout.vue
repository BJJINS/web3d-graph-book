<template>
  <div class="memory-layout-scroll">
    <div
      class="memory-layout"
      role="img"
      aria-label="Memory layout diagram with scale, offset, projection and padding bytes."
    >
      <div class="layout-row header-row">
        <div class="offset-cell offset-title">offset</div>
        <div class="bytes-strip header-strip">
          <div class="field field-scale-header" style="--start: 0; --span: 4">
            <span class="field-name">.scale</span>
          </div>
          <div class="field field-pad-header" style="--start: 4; --span: 12">
            <span class="field-name">-pad-</span>
          </div>
        </div>
      </div>

      <div class="layout-row data-row">
        <div class="offset-cell offset-value">0</div>
        <div class="bytes-strip data-strip data-scale">
          <div class="field field-scale-data" style="--start: 0; --span: 4"></div>
          <div class="f32-label" style="--start: 0">f32</div>
        </div>
      </div>

      <div class="layout-row header-row">
        <div class="offset-cell offset-empty"></div>
        <div class="bytes-strip header-strip">
          <div class="field field-offset-header" style="--start: 0; --span: 12">
            <span class="field-name">.offset</span>
          </div>
          <div class="field field-pad-header" style="--start: 12; --span: 4">
            <span class="field-name">-pad-</span>
          </div>
        </div>
      </div>

      <div class="layout-row data-row">
        <div class="offset-cell offset-value">16</div>
        <div class="bytes-strip data-strip data-offset">
          <div class="field field-offset-data" style="--start: 0; --span: 12"></div>
          <div
            v-for="start in vec3Groups"
            :key="`offset-${start}`"
            class="f32-label"
            :style="{ '--start': start }"
          >
            f32
          </div>
        </div>
      </div>

      <template v-for="offset in projectionOffsets" :key="`projection-${offset}`">
        <div class="layout-row header-row">
          <div class="offset-cell offset-empty"></div>
          <div class="bytes-strip header-strip">
            <div class="field field-projection-header" style="--start: 0; --span: 16">
              <span class="field-name">.projection</span>
            </div>
          </div>
        </div>

        <div class="layout-row data-row">
          <div class="offset-cell offset-value">{{ offset }}</div>
          <div class="bytes-strip data-strip data-projection">
            <div class="field field-projection-data" style="--start: 0; --span: 16"></div>
            <div
              v-for="start in vec4Groups"
              :key="`projection-${offset}-${start}`"
              class="f32-label"
              :style="{ '--start': start }"
            >
              f32
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const vec3Groups = [0, 4, 8];
const vec4Groups = [0, 4, 8, 12];
const projectionOffsets = [32, 48, 64, 80];
</script>

<style scoped>
.memory-layout-scroll {
  margin: 12px 0;
  overflow-x: auto;
}

.memory-layout {
  min-width: 1024px;
  border: 2px solid #1d1d1d;
  background: #d9d9d9;
  font-family: "Times New Roman", Georgia, serif;
}

.layout-row {
  display: grid;
  grid-template-columns: 56px 1fr;
}

.layout-row + .layout-row {
  border-top: 2px solid #1d1d1d;
}

.header-row {
  height: 28px;
}

.data-row {
  height: 60px;
}

.offset-cell {
  border-right: 2px solid #1d1d1d;
  background: #e7e7e7;
  display: flex;
  align-items: center;
  padding-left: 4px;
  line-height: 1;
}

.offset-title {
  font-size: 40px;
}

.offset-empty {
  font-size: 0;
}

.offset-value {
  font-size: 50px;
}

.bytes-strip {
  position: relative;
  overflow: hidden;
}

.header-strip {
  background: #d8d8d8;
}

.data-strip {
  background: #d8d8d8;
}

.data-strip::before,
.data-strip::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.data-strip::before {
  background-image: repeating-linear-gradient(
    to right,
    transparent 0,
    transparent calc(6.25% - 1px),
    rgba(0, 0, 0, 0.2) calc(6.25% - 1px),
    rgba(0, 0, 0, 0.2) 6.25%
  );
}

.data-strip::after {
  background-image: repeating-linear-gradient(
    to right,
    transparent 0,
    transparent calc(25% - 2px),
    rgba(0, 0, 0, 0.5) calc(25% - 2px),
    rgba(0, 0, 0, 0.5) 25%
  );
}

.field {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc((100% / 16) * var(--start));
  width: calc((100% / 16) * var(--span));
}

.field-name {
  position: absolute;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
  font-size: 38px;
  line-height: 1;
  color: #111;
}

.field-scale-header {
  background: #d7a8db;
}

.field-pad-header {
  background: #d8d8d8;
}

.field-offset-header {
  background: #e8e878;
}

.field-projection-header {
  background: #70e4d5;
}

.field-scale-data {
  background: #d987ab;
}

.field-offset-data {
  background: #bda961;
}

.field-projection-data {
  background: #62ba9d;
}

.data-scale {
  --f32-color: rgba(129, 77, 103, 0.58);
}

.data-offset {
  --f32-color: rgba(123, 107, 56, 0.58);
}

.data-projection {
  --f32-color: rgba(42, 120, 106, 0.6);
}

.f32-label {
  position: absolute;
  top: 50%;
  left: calc((100% / 16) * (var(--start) + 2));
  transform: translate(-50%, -50%);
  font-size: 48px;
  font-weight: 600;
  line-height: 1;
  color: var(--f32-color);
}
</style>
