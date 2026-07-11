export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordChangeValidationResult =
  | { valid: true }
  | { valid: false; message: string };

const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordChangeInput(input: PasswordChangeInput): PasswordChangeValidationResult {
  if (!input.currentPassword) {
    return { valid: false, message: "Current password is required." };
  }

  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (input.newPassword !== input.confirmPassword) {
    return { valid: false, message: "New password and confirmation do not match." };
  }

  if (input.currentPassword === input.newPassword) {
    return { valid: false, message: "New password must be different from your current password." };
  }

  return { valid: true };
}
