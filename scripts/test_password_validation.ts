import assert from "node:assert/strict";
import { validatePasswordChangeInput } from "../src/lib/passwordValidation.ts";

assert.deepEqual(
  validatePasswordChangeInput({
    currentPassword: "",
    newPassword: "new-password",
    confirmPassword: "new-password",
  }),
  { valid: false, message: "Current password is required." },
);

assert.deepEqual(
  validatePasswordChangeInput({
    currentPassword: "old-password",
    newPassword: "short",
    confirmPassword: "short",
  }),
  { valid: false, message: "New password must be at least 8 characters." },
);

assert.deepEqual(
  validatePasswordChangeInput({
    currentPassword: "old-password",
    newPassword: "new-password",
    confirmPassword: "different-password",
  }),
  { valid: false, message: "New password and confirmation do not match." },
);

assert.deepEqual(
  validatePasswordChangeInput({
    currentPassword: "same-password",
    newPassword: "same-password",
    confirmPassword: "same-password",
  }),
  { valid: false, message: "New password must be different from your current password." },
);

assert.deepEqual(
  validatePasswordChangeInput({
    currentPassword: "old-password",
    newPassword: "new-password",
    confirmPassword: "new-password",
  }),
  { valid: true },
);

console.log("Password validation tests passed.");
