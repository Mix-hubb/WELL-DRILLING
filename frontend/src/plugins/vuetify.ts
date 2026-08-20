import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

// ============================================================
// Well-Drilling — Minimalist Earth Tone Design System
// Cream Beige · Warm Grey · Clay Brown · Dim Slate Blue
// ============================================================
const lightTheme = {
  dark: false,
  colors: {
    background:          "#F0EAE0",  // cream beige — page BG
    surface:             "#F7F3EB",  // warm cream — card surface
    "surface-variant":   "#E6DDD1",  // stone — input borders, dividers
    "surface-bright":    "#FDFAF5",  // lightest cream — elevated surfaces

    primary:             "#4A6278",  // dim slate blue — primary actions
    "primary-darken-1":  "#3A5068",
    secondary:           "#7A4F36",  // clay brown — headings, accents
    "secondary-darken-1":"#633F2A",

    success:             "#4E7A52",  // muted forest green — IN_WARRANTY
    warning:             "#8A6A2A",  // amber earth — EXPIRING_SOON
    error:               "#7A3A2A",  // clay red — EXPIRED / errors
    info:                "#3E6878",  // steel blue — info

    // Status colors (accessible via CSS var or Vuetify color prop)
    "status-pending":    "#6A7A8A",  // slate
    "status-drilling":   "#7A5A2A",  // active brown
    "status-completed":  "#4A6A5A",  // completed green
    "status-archived":   "#908880",  // muted warm grey

    "on-background":     "#2E2418",  // dark earth text
    "on-surface":        "#2E2418",
    "on-primary":        "#F7F3EB",
    "on-secondary":      "#F7F3EB",
    "on-success":        "#F7F3EB",
    "on-warning":        "#F7F3EB",
    "on-error":          "#F7F3EB",
  },
};

const darkTheme = {
  dark: true,
  colors: {
    background:          "#1C1814",
    surface:             "#242018",
    "surface-variant":   "#3A3228",
    "surface-bright":    "#2E2820",
    primary:             "#7A9AB2",  // lighter slate blue
    "primary-darken-1":  "#6A8AA2",
    secondary:           "#C88060",  // warm terracotta
    success:             "#7AB882",
    warning:             "#C8A050",
    error:               "#C06848",
    info:                "#6898A8",
    "status-pending":    "#8A9AAA",
    "status-drilling":   "#C89A58",
    "status-completed":  "#78A888",
    "status-archived":   "#706860",
    "on-background":     "#F5F0E8",
    "on-surface":        "#F5F0E8",
    "on-primary":        "#1C1814",
    "on-secondary":      "#1C1814",
    "on-success":        "#1C1814",
    "on-warning":        "#1C1814",
    "on-error":          "#EEE8DE",
  },
  variables: {
    "high-emphasis-opacity":    0.95,
    "medium-emphasis-opacity":  0.82,
    "disabled-opacity":         0.45,
  },
};

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "lightTheme",
    themes: { lightTheme, darkTheme },
  },
  defaults: {
    VCard: {
      elevation: 0,
      rounded: "xl",
      border: true,
    },
    VBtn: {
      rounded: "lg",
      style: "min-height: 44px;",  // mobile touch target NFR-01
    },
    VChip: { rounded: "pill", size: "small" },
    VTextField: { variant: "outlined", density: "comfortable" },
    VSelect:    { variant: "outlined", density: "comfortable" },
    VTextarea:  { variant: "outlined", density: "comfortable" },
    VAutocomplete: { variant: "outlined", density: "comfortable" },
    VList:      { bgColor: "transparent" },
  },
});
