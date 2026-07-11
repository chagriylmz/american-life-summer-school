const SUMMER_SCHOOL_ACTIVE_DAYS = new Set([1, 2, 3]);

export function getPreviousSummerSchoolDate(dateValue: string) {
  for (let offset = -1; offset >= -7; offset -= 1) {
    const candidate = getDateOffset(dateValue, offset);
    if (isSummerSchoolActiveDate(candidate)) return candidate;
  }

  throw new Error(`Could not find previous summer school day for ${dateValue}`);
}

export function isSummerSchoolActiveDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return SUMMER_SCHOOL_ACTIVE_DAYS.has(date.getDay());
}

export function getDateOffset(dateValue: string, offsetDays: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return formatLocalDate(date);
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
