export const SUPPORTED_USER_ROLES = ["admin", "staff", "teacher", "student"] as const;

export type SupportedUserRole = (typeof SUPPORTED_USER_ROLES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_TEMP_PASSWORD_LENGTH = 8;

export function isSupportedUserRole(value: unknown): value is SupportedUserRole {
  return typeof value === "string" && SUPPORTED_USER_ROLES.includes(value as SupportedUserRole);
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Email is required.");
  }

  const normalized = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }

  return normalized;
}

export function normalizeFullName(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Full name is required.");
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    throw new Error("Full name is required.");
  }

  return normalized;
}

export function normalizeTemporaryPassword(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Temporary password is required.");
  }

  if (value.length < MIN_TEMP_PASSWORD_LENGTH) {
    throw new Error(`Temporary password must be at least ${MIN_TEMP_PASSWORD_LENGTH} characters.`);
  }

  return value;
}

export function normalizeRole(value: unknown) {
  if (!isSupportedUserRole(value)) {
    throw new Error(`Role must be one of: ${SUPPORTED_USER_ROLES.join(", ")}.`);
  }

  return value;
}

export function normalizeIsActive(value: unknown) {
  if (typeof value === "undefined") return true;
  if (typeof value !== "boolean") {
    throw new Error("Active status must be true or false.");
  }

  return value;
}

export function normalizeUserId(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("User ID is required.");
  }

  return value.trim();
}
