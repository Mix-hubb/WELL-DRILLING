import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useUiStore } from "./ui";

describe("ui store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("defaults to the light theme", () => {
    const store = useUiStore();
    expect(store.theme).toBe("lightTheme");
  });

  it("reads the saved theme from localStorage", () => {
    localStorage.setItem("welldrill-theme", "darkTheme");
    setActivePinia(createPinia());
    const store = useUiStore();
    expect(store.theme).toBe("darkTheme");
  });

  it("toggleTheme flips the theme and persists it", () => {
    const store = useUiStore();
    store.toggleTheme();
    expect(store.theme).toBe("darkTheme");
    expect(localStorage.getItem("welldrill-theme")).toBe("darkTheme");

    store.toggleTheme();
    expect(store.theme).toBe("lightTheme");
    expect(localStorage.getItem("welldrill-theme")).toBe("lightTheme");
  });

  it("notify shows the snackbar with given text and color", () => {
    const store = useUiStore();
    store.notify("บันทึกแล้ว", "success");
    expect(store.snackbar).toEqual({ show: true, text: "บันทึกแล้ว", color: "success" });
  });

  it("notify defaults to the info color", () => {
    const store = useUiStore();
    store.notify("สวัสดี");
    expect(store.snackbar.color).toBe("info");
  });

  it("notifyError extracts the message from an Error", () => {
    const store = useUiStore();
    store.notifyError(new Error("HTTP 500"));
    expect(store.snackbar).toEqual({ show: true, text: "HTTP 500", color: "error" });
  });

  it("notifyError falls back to a generic message for unknown values", () => {
    const store = useUiStore();
    store.notifyError("boom");
    expect(store.snackbar).toEqual({ show: true, text: "เกิดข้อผิดพลาด", color: "error" });
  });
});