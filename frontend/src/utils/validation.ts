export const requiredField = (message: string) => (value: unknown) => {
  if (value === null || value === undefined || value === "") return message;
  return true;
};

export const validEmail = (message: string) => (value: string) => {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || message;
};

export const validPhone = (message: string) => (value: string) => {
  if (!value) return true;
  return /^\d{9,10}$/.test(value.replace(/[-\s]/g, "")) || message;
};
