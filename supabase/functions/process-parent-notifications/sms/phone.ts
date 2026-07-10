export function normalizeTurkishMobileForNetgsm(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D+/g, "");
  if (digits.startsWith("90") && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (/^5\d{9}$/.test(digits)) {
    return digits;
  }

  return null;
}

export function maskPhone(value: string) {
  const digits = value.replace(/\D+/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}
