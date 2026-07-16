<script setup lang="ts">
import { computed } from "vue";

/* ----------------------------------------------------------------
   Props — ใช้ข้อมูล strata ที่ join lithology_types มาแล้วจาก API
   fill_color, svg_pattern, lithology_name มาจาก wells.controller
   ---------------------------------------------------------------- */
interface StrataLayer {
  strata_id: number;
  depth_from: number;
  depth_to: number;
  fill_color: string;
  svg_pattern: string;          // solid | hatched | dotted | crossed
  lithology_name: string;
  lithology_name_th: string;
  is_water_bearing: number;     // 0 | 1
  hardness?: string;
  conductivity_us?: number;
  ph_value?: number;
  tds_ppm?: number;
  description?: string;
}
interface PipeLayer {
  pipe_id: number;
  depth_from: number;
  depth_to: number;
  pipe_type: string;            // CASING_PVC | SCREEN_PVC | CASING_STEEL | SCREEN_STEEL
  pipe_size: string;
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
    if (seen.has(s.lithology_name)) return false;
    seen.add(s.lithology_name);
    return true;
  });
});

function yPos(depth: number) { return depth * SCALE.value; }
function layerH(s: StrataLayer) {
  return Math.max((s.depth_to - s.depth_from) * SCALE.value, 2);
}

// Tooltip text
function strataTitle(s: StrataLayer) {
  let t = `${s.depth_from}–${s.depth_to} ม. · ${s.lithology_name_th}`;
  if (s.is_water_bearing) t += " 💧 ชั้นน้ำ";
  if (s.ph_value)         t += ` · pH ${s.ph_value}`;
  if (s.tds_ppm)          t += ` · TDS ${s.tds_ppm} mg/L`;
  if (s.description)      t += `\n${s.description}`;
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
    <div class="flex-shrink-0 position-relative" style="border-radius:4px;overflow:hidden;border:1.5px solid rgba(0,0,0,0.2)">
      <svg
        :width="SVG_COL_W"
        :height="totalH"
        :viewBox="`0 0 ${SVG_COL_W} ${totalH}`"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- ---- Pattern Defs ---- -->
        <defs>
          <!-- hatched: หินผุ -->
          <pattern id="pat-hatched" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#00000028" stroke-width="1.2"/>
          </pattern>
          <!-- dotted: ทราย/กรวด -->
          <pattern id="pat-dotted" patternUnits="userSpaceOnUse" width="7" height="7">
            <circle cx="3.5" cy="3.5" r="1.3" fill="#00000030"/>
          </pattern>
          <!-- crossed: หินแข็ง -->
          <pattern id="pat-crossed" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M0,0 L8,8 M8,0 L0,8" stroke="#00000022" stroke-width="1"/>
          </pattern>
        </defs>

        <!-- ---- Strata Rectangles ---- -->
        <g v-for="s in strata" :key="s.strata_id">
          <title>{{ strataTitle(s) }}</title>

          <!-- Base fill -->
          <rect
            :x="0" :y="yPos(s.depth_from)"
            :width="SVG_COL_W" :height="layerH(s)"
            :fill="s.fill_color"
          />

          <!-- Texture overlay (non-solid patterns) -->
          <rect
            v-if="s.svg_pattern && s.svg_pattern !== 'solid'"
            :x="0" :y="yPos(s.depth_from)"
            :width="SVG_COL_W" :height="layerH(s)"
            :fill="`url(#pat-${s.svg_pattern})`"
          />

          <!-- Water-bearing: แถบฟ้าซ้าย -->
          <rect
            v-if="s.is_water_bearing"
            :x="0" :y="yPos(s.depth_from)"
            :width="7" :height="layerH(s)"
            fill="#4A8AB0" opacity="0.85"
          />

          <!-- Layer border -->
          <line
            :x1="0" :y1="yPos(s.depth_from)"
            :x2="SVG_COL_W" :y2="yPos(s.depth_from)"
            stroke="rgba(0,0,0,0.18)" stroke-width="1"
          />

          <!-- Label (แสดงเฉพาะชั้นที่หนาพอ) -->
          <text
            v-if="layerH(s) >= 18"
            :x="SVG_COL_W / 2 + 4"
            :y="yPos(s.depth_from) + layerH(s) / 2"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="9"
            fill="rgba(0,0,0,0.65)"
            font-family="'IBM Plex Sans Thai','Sarabun',sans-serif"
          >{{ s.lithology_name_th }}</text>
        </g>

        <!-- ---- Casing / Pipe Overlay (right side) ---- -->
        <g v-for="p in (pipes || [])" :key="p.pipe_id">
          <title>{{ p.depth_from }}–{{ p.depth_to }} ม. · {{ p.pipe_type }} · {{ p.pipe_size }}</title>
          <rect
            :x="SVG_COL_W - 18"
            :y="yPos(p.depth_from)"
            :width="16"
            :height="Math.max((p.depth_to - p.depth_from) * SCALE, 2)"
            :fill="p.pipe_type.includes('STEEL') ? '#9AADA8' : '#A8C4D0'"
            :stroke="p.pipe_type.startsWith('SCREEN') ? 'rgba(0,80,120,0.6)' : 'rgba(0,60,80,0.4)'"
            :stroke-dasharray="p.pipe_type.startsWith('SCREEN') ? '3,2' : 'none'"
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
      <div v-for="s in legend" :key="s.lithology_name" class="d-flex align-start ga-2 text-caption mb-2">
        <span
          class="rounded-sm mt-1 flex-shrink-0"
          :style="{
            width: '12px', height: '12px',
            background: s.fill_color,
            border: '1px solid rgba(0,0,0,0.2)',
            display: 'inline-block'
          }"
        />
        <div>
          <div class="font-weight-medium">{{ s.lithology_name_th }}</div>
          <div class="text-medium-emphasis" style="font-size:10px">{{ s.lithology_name }}</div>
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
