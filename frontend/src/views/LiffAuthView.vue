<script setup lang="ts">
import { onMounted } from "vue";
import liff from "@line/liff";

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const liffId = params.get("liffId") || "";
  const redirect = params.get("redirect") || "/request-drill";

  if (!liffId) {
    document.body.innerHTML = "<p style='text-align:center;padding:40px'>ไม่พบ liffId</p>";
    return;
  }

  try {
    await liff.init({ liffId });
  } catch (e) {
    document.body.innerHTML = `<p style='text-align:center;padding:40px'>LIFF init error: ${e}</p>`;
    return;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }

  window.location.href = `${redirect}?liffId=${liffId}`;
});
</script>

<template>
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F0EAE0;">
    <div style="text-align:center">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div style="margin-top:16px;color:#6A7A8A;font-size:14px">กำลังเข้าสู่ระบบ LINE...</div>
    </div>
  </div>
</template>
