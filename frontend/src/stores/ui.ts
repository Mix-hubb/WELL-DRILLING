import { defineStore } from "pinia";

type SnackbarColor = "success" | "error" | "info" | "warning";

export const useUiStore = defineStore("ui", {
  state: () => ({
    theme: (localStorage.getItem("welldrill-theme") as "lightTheme" | "darkTheme") || "lightTheme",
    snackbar: { show: false, text: "", color: "info" as SnackbarColor },
  }),
  actions: {
    toggleTheme() {
      this.theme = this.theme === "lightTheme" ? "darkTheme" : "lightTheme";
      localStorage.setItem("welldrill-theme", this.theme);
    },
    notify(text: string, color: SnackbarColor = "info") {
      this.snackbar = { show: true, text, color };
    },
    notifyError(err: unknown) {
      const text = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      this.notify(text, "error");
    },
  },
});
