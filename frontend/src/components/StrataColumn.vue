<script setup lang="ts">
import { computed } from "vue";

interface StrataLayer {
  strata_id: number;
  depth_from_m: number;
  depth_to_m: number;
  lithology_name?: string | null;
  color_hex?: string | null;
  water_bearing?: number;       // 0 | 1
  hardness?: string | null;
  description?: string | null;
}
interface PipeLayer {
  pipe_id: number;
  depth_from_m: number;
  depth_to_m: number;
  material?: string | null;     // PVC | STEEL | STAINLESS_STEEL | HDPE | OTHER
  pipe_type?: string | null;    // CASING | SCREEN
  size_mm?: number | null;
}

const props = defineProps<{
  strata: StrataLayer[];
  totalDepth: number;
  pipes?: PipeLayer[];
}>();

// ----------------------------------------------------------------
// Scale: ปรับ px/meter ตามความลึกรวม (วิ่งได้สวย ทั้งบ่อตื้น-ลึก)
// ----------------------------------------------------------------
const SCALE = computed(() => {
  if (props.totalDepth > 150) return 3;
  if (props.totalDepth > 80)  return 5;
  if (props.totalDepth > 40)  return 8;
  return 12;
});

const SVG_COL_W = 140;
const totalH = computed(() => Math.max(props.totalDepth * SCALE.value, 120));

// Depth ruler ticks — ทุก 10 ม. (ถ้าลึกมาก) หรือทุก 5 ม.
const ticks = computed(() => {
  const step = props.totalDepth > 100 ? 20 : props.totalDepth > 50 ? 10 : 5;
  const arr: number[] = [];
  for (let d = 0; d <= props.totalDepth; d += step) arr.push(d);
  return arr;
});

// legend เฉพาะ lithology ไม่ซ้ำ
const legend = computed(() => {
  const seen = new Set<string>();
  return props.strata.filter((s) => {
    const key = s.lithology_name || "ชั้น";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const isSteel = (p: PipeLayer) => (p.material === "STEEL" || p.material === "STAINLESS_STEEL");
const isScreen = (p: PipeLayer) => (p.pipe_type === "SCREEN");

function yPos(depth: number) { return depth * SCALE.value; }
function layerH(s: StrataLayer) {
  return Math.max((s.depth_to_m - s.depth_from_m) * SCALE.value, 2);
}

// Tooltip text
function strataTitle(s: StrataLayer) {
  let t = `${s.depth_from_m}–${s.depth_to_m} ม. · ${s.lithology_name || "-"}`;
  if (s.water_bearing) t += " 💧 ชั้นน้ำ";
  if (s.description)   t += `\n${s.description}`;
  return t;
}
</script>

<template>
  <div class="d-flex ga-3 align-start strata-wrapper">

    <!-- ========= Depth Ruler ========= -->
    <div
      class="position-relative flex-shrink-0"
      :style="{ width: '38px', height: `${totalH}px` }"
    >
      <div
        v-for="d in ticks" :key="d"
        class="position-absolute d-flex align-center ga-1"
        :style="{ top: `${yPos(d) - 7}px`, right: 0 }"
      >
        <span class="font-mono text-caption text-medium-emphasis" style="font-size:10px">{{ d }}</span>
        <div style="width:6px;height:1px;background:currentColor;opacity:0.4"/>
      </div>
      <!-- Bottom tick -->
      <div
        class="position-absolute d-flex align-center ga-1"
        :style="{ top: `${totalH - 8}px`, right: 0 }"
      >
        <span class="font-mono text-caption text-medium-emphasis" style="font-size:10px">{{ totalDepth }}</span>
        <div style="width:6px;height:1px;background:currentColor;opacity:0.4"/>
      </div>
    </div>

    <!-- ========= SVG Core Column ========= -->
    <div class="flex-shrink-0 position-relative strata-svg-container" style="border-radius:4px;overflow:hidden;border:1.5px solid rgba(0,0,0,0.2)">
      <svg
        :width="SVG_COL_W"
        :height="totalH"
        :viewBox="`0 0 ${SVG_COL_W} ${totalH}`"
        xmlns="http://www.w3.org/2000/svg"
        style="display:block;max-width:100%;height:auto"
      >
        <!-- ---- Pattern Defs ---- -->
        <defs>
          <!-- (textures removed: new schema uses flat color_hex) -->
        </defs>

        <!-- ---- Strata Rectangles ---- -->
        <g v-for="s in strata" :key="s.strata_id">
          <title>{{ strataTitle(s) }}</title>

          <!-- Base fill -->
          <rect
            :x="0" :y="yPos(s.depth_from_m)"
            :width="SVG_COL_W" :height="layerH(s)"
            :fill="s.color_hex || '#A0856C'"
          />

          <!-- Water-bearing: แถบฟ้าซ้าย -->
          <rect
            v-if="s.water_bearing"
            :x="0" :y="yPos(s.depth_from_m)"
            :width="7" :height="layerH(s)"
            fill="#4A8AB0" opacity="0.85"
          />

          <!-- Layer border -->
          <line
            :x1="0" :y1="yPos(s.depth_from_m)"
            :x2="SVG_COL_W" :y2="yPos(s.depth_from_m)"
            stroke="rgba(0,0,0,0.18)" stroke-width="1"
          />

          <!-- Label (แสดงเฉพาะชั้นที่หนาพอ) -->
          <text
            v-if="layerH(s) >= 18"
            :x="SVG_COL_W / 2 + 4"
            :y="yPos(s.depth_from_m) + layerH(s) / 2"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="9"
            fill="rgba(0,0,0,0.65)"
            font-family="'IBM Plex Sans Thai','Sarabun',sans-serif"
          >{{ s.lithology_name }}</text>
        </g>

        <!-- ---- Casing / Pipe Overlay (right side) ---- -->
        <g v-for="p in (pipes || [])" :key="p.pipe_id">
          <title>{{ p.depth_from_m }}–{{ p.depth_to_m }} ม. · {{ p.pipe_type }} · {{ p.size_mm }} mm</title>
          <rect
            :x="SVG_COL_W - 18"
            :y="yPos(p.depth_from_m)"
            :width="16"
            :height="Math.max((p.depth_to_m - p.depth_from_m) * SCALE, 2)"
            :fill="isSteel(p) ? '#9AADA8' : '#A8C4D0'"
            :stroke="isScreen(p) ? 'rgba(0,80,120,0.6)' : 'rgba(0,60,80,0.4)'"
            :stroke-dasharray="isScreen(p) ? '3,2' : 'none'"
            stroke-width="1.5"
            rx="2"
            opacity="0.9"
          />
        </g>

        <!-- Bottom cap line -->
        <line
          :x1="0" :y1="totalH - 1"
          :x2="SVG_COL_W" :y2="totalH - 1"
          stroke="rgba(0,0,0,0.35)" stroke-width="2"
        />
      </svg>
    </div>

    <!-- ========= Legend ========= -->
    <div class="flex-grow-1" style="min-width:140px;max-width:220px">
      <!-- Water-bearing indicator -->
      <div class="d-flex align-center ga-2 mb-3">
        <div style="width:10px;height:16px;background:#4A8AB0;border-radius:2px;flex-shrink:0"/>
        <span class="text-caption text-medium-emphasis">💧 ชั้นน้ำบาดาล</span>
      </div>
      <div v-for="s in legend" :key="s.strata_id" class="d-flex align-start ga-2 text-caption mb-2">
        <span
          class="rounded-sm mt-1 flex-shrink-0"
          :style="{
            width: '12px', height: '12px',
            background: s.color_hex || '#A0856C',
            border: '1px solid rgba(0,0,0,0.2)',
            display: 'inline-block'
          }"
        />
        <div>
          <div class="font-weight-medium">{{ s.lithology_name || "-" }}</div>
        </div>
      </div>

      <!-- Casing legend -->
      <div v-if="pipes && pipes.length" class="mt-3 pt-3" style="border-top:1px solid rgba(0,0,0,0.1)">
        <div class="text-caption font-weight-medium mb-1 text-medium-emphasis">ท่อบ่อ</div>
        <div class="d-flex align-center ga-2 mb-1">
          <div style="width:12px;height:12px;background:#A8C4D0;border:1px solid rgba(0,80,120,0.4);border-radius:2px;flex-shrink:0"/>
          <span class="text-caption text-medium-emphasis">ท่อ PVC</span>
        </div>
        <div class="d-flex align-center ga-2">
          <div style="width:12px;height:12px;background:#9AADA8;border:1px solid rgba(0,60,80,0.4);border-radius:2px;flex-shrink:0"/>
          <span class="text-caption text-medium-emphasis">ท่อเหล็ก</span>
        </div>
      </div>
    </div>

  </div>
</template>
