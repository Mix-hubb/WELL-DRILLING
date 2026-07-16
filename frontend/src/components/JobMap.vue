<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from "vue";
import L from "leaflet";
import { useRouter } from "vue-router";
import type { DrillingJob } from "@/types";
import { STATUS_HEX, STATUS } from "@/constants";

const props = defineProps<{ jobs: DrillingJob[] }>();
const router = useRouter();

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markers: L.CircleMarker[] = [];

function makeIcon(color: string) {
  return { radius: 9, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.95 };
}

function renderMarkers() {
  if (!map) return;
  markers.forEach((m) => m.remove());
  markers = [];

  const valid = props.jobs.filter((j) => j.latitude != null && j.longitude != null);
  valid.forEach((j) => {
    const lat = j.latitude!;
    const lng = j.longitude!;
    const marker = L.circleMarker([lat, lng], makeIcon(STATUS_HEX[j.status]));
    marker.bindPopup(`
      <div style="font-family: Inter, sans-serif; min-width: 180px;">
        <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(j.job_title)}</div>
        <div style="font-size:12px; color:#666; margin-bottom:6px;">${escapeHtml(j.site_address)}</div>
        <div style="font-size:11px; font-weight:700; color:${STATUS_HEX[j.status]};">${STATUS[j.status].label}</div>
        <button id="goto-${j.job_id}" style="margin-top:8px; font-size:12px; padding:4px 10px; border-radius:6px; border:1px solid #ccc; background:#fff; cursor:pointer;">ดูรายละเอียด</button>
      </div>
    `);
    marker.on("popupopen", () => {
      const btn = document.getElementById(`goto-${j.job_id}`);
      btn?.addEventListener("click", () => router.push(`/jobs/${j.job_id}`));
    });
    marker.addTo(map!);
    markers.push(marker);
  });

  if (valid.length) {
    const bounds = L.latLngBounds(valid.map((j) => [j.latitude!, j.longitude!] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

onMounted(() => {
  if (!mapEl.value) return;
  map = L.map(mapEl.value, { zoomControl: true }).setView([15.05, 102.1], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
  renderMarkers();
});

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});

watch(() => props.jobs, renderMarkers, { deep: true });

function escapeHtml(str: string) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
</script>

<template>
  <div ref="mapEl" style="width: 100%; height: 100%; min-height: 400px; border-radius: 12px;" />
</template>
