import { onMounted, ref } from "vue";
import { repairRequestsApi } from "@/api/repairRequests";
import { useUiStore } from "@/stores/ui";
import type { PumpCatalogModel, RepairRequest } from "@/types";

export interface RepairPartEntry {
  name: string;
  qty: number;
  unit_price: number;
}

export function useDrillerRepairForm(token: string) {
  const ui = useUiStore();
  const request = ref<RepairRequest | null>(null);
  const loading = ref(true);
  const submitting = ref(false);
  const saved = ref(false);
  const form = ref({
    work_details: "",
    parts: [{ name: "", qty: 1, unit_price: 0 }] as RepairPartEntry[],
    final_price: "",
    is_warranty_claim: false,
    completed_at: new Date().toISOString().slice(0, 10),
    pump: null as PumpCatalogModel | null,
  });

  onMounted(async () => {
    try {
      request.value = await repairRequestsApi.getByMagicToken(token);
    } catch (error) {
      ui.notifyError(error);
    } finally {
      loading.value = false;
    }
  });

  function addPart() { form.value.parts.push({ name: "", qty: 1, unit_price: 0 }); }
  function removePart(index: number) { form.value.parts.splice(index, 1); }

  async function submit() {
    if (!request.value || !form.value.work_details) return;
    submitting.value = true;
    try {
      await repairRequestsApi.addRecord(request.value.repair_id, {
        magic_token: token,
        work_details: form.value.work_details,
        parts: form.value.parts.filter((part) => part.name).map((part) => ({
          name: part.name, qty: Number(part.qty) || 0, unit_price: Number(part.unit_price) || 0,
        })),
        pump: form.value.pump,
        final_price: form.value.final_price ? Number(form.value.final_price) : null,
        is_warranty_claim: form.value.is_warranty_claim ? 1 : 0,
        completed_at: form.value.completed_at,
      });
      saved.value = true;
    } catch (error) {
      ui.notifyError(error);
    } finally {
      submitting.value = false;
    }
  }

  return { request, loading, submitting, saved, form, addPart, removePart, submit };
}