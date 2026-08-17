<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { pumpCatalogApi } from "@/api/pumpCatalog";
import type { PumpCatalogModel } from "@/types";

const props = withDefaults(defineProps<{
  modelValue?: PumpCatalogModel | null;
  brand?: string;
  label?: string;
}>(), {
  modelValue: null,
  brand: "",
  label: "รุ่นปั๊ม",
});

const emit = defineEmits<{
  (e: "update:modelValue", v: PumpCatalogModel | null): void;
}>();

/* fetch catalog once (แคชระดับโมดูล — ใช้ร่วมกันได้หลายฟอร์ม) */
let catalogPromise: Promise<PumpCatalogModel[]> | null = null;
function loadCatalog(): Promise<PumpCatalogModel[]> {
  if (!catalogPromise) {
    catalogPromise = pumpCatalogApi.list().catch((e) => {
      catalogPromise = null;
      throw e;
    });
  }
  return catalogPromise;
}

const models  = ref<PumpCatalogModel[]>([]);
const loading = ref(false);
const brand   = ref(props.brand || props.modelValue?.brand || "");
const modelId = ref<number | null>(props.modelValue?.model_id ?? null);

const brandOptions = computed(() => {
  const brands = new Set(models.value.map((m) => m.brand).filter(Boolean));
  return [...brands].map((value) => ({
    value,
    title: value === "FRANKLIN" ? "Franklin Electric" : value,
  }));
});

const modelOptions = computed(() =>
  models.value
    .filter((m) => m.brand === brand.value)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
);

const selected = computed<PumpCatalogModel | null>(
  () => modelOptions.value.find((m) => m.model_id === modelId.value) || null
);

watch(brand, () => {
  modelId.value = null;
});

watch(modelId, (v) => {
  emit("update:modelValue", v ? modelOptions.value.find((m) => m.model_id === v) || null : null);
});

onMounted(async () => {
  loading.value = true;
  try {
    models.value = await loadCatalog();
  } catch (e) {
    /* ทิ้งให้ฟอร์มกรอกเองได้ — ไม่ block UI */
  } finally {
    loading.value = false;
  }
});

function fmt(n: number | null | undefined): string {
  return n == null ? "" : `${new Intl.NumberFormat("th-TH").format(n)} บาท`;
}
</script>

<template>
  <div>
    <v-row dense>
      <v-col cols="6">
        <v-autocomplete
          v-model="brand"
          :items="brandOptions"
          item-title="title"
          item-value="value"
          label="ยี่ห้อ (จากแคตตาล็อก)"
          placeholder="เลือกยี่ห้อ เช่น Franklin, TORQUE"
          clearable
          :loading="loading"
          density="compact"
          hide-details="auto"
        />
      </v-col>
      <v-col cols="6">
        <v-autocomplete
          v-model="modelId"
          :items="modelOptions"
          item-title="model"
          item-value="model_id"
          :label="label"
          placeholder="เลือกยี่ห้อก่อน"
          clearable
          :disabled="!brand"
          density="compact"
          hide-details="auto"
        />
      </v-col>
    </v-row>

    <div
      v-if="selected"
      class="mt-2 pa-2 rounded"
      style="border:1px solid rgba(0,0,0,0.12);background:rgba(0,0,0,0.03)"
    >
      <div class="text-caption font-weight-bold mb-1">
        ข้อมูลปั๊ม: {{ selected.brand }} · {{ selected.model }}
      </div>
      <v-row dense class="text-caption">
        <v-col v-if="selected.series" cols="6">ซีรีส์: {{ selected.series }}</v-col>
        <v-col v-if="selected.bore_size" cols="6">บ่อ: {{ selected.bore_size }}"</v-col>
        <v-col v-if="selected.motor_power" cols="6">กำลัง: {{ selected.motor_power }}</v-col>
        <v-col v-if="selected.phase" cols="6">ไฟ: {{ selected.phase }}</v-col>
        <v-col v-if="selected.flow_rate" cols="6">ไหล: {{ selected.flow_rate }}</v-col>
        <v-col v-if="selected.discharge_size" cols="6">ท่อจ่าย: {{ selected.discharge_size }}</v-col>
        <v-col v-if="selected.impeller_stages" cols="6">ใบพัด: {{ selected.impeller_stages }}</v-col>
        <v-col v-if="selected.max_head_m" cols="6">เฮดสูงสุด: {{ selected.max_head_m }}</v-col>
        <v-col v-if="selected.material" cols="12">วัสดุ: {{ selected.material }}</v-col>
        <v-col v-if="selected.features" cols="12">จุดเด่น: {{ selected.features }}</v-col>
        <v-col v-if="selected.reference_price" cols="6" class="font-weight-bold text-primary">
          ราคาอ้างอิง: {{ fmt(selected.reference_price) }}
        </v-col>
        <v-col v-if="selected.notes" cols="12" class="text-medium-emphasis">{{ selected.notes }}</v-col>
      </v-row>
    </div>
  </div>
</template>
