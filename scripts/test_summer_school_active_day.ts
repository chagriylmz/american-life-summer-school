import assert from "node:assert/strict";
import {
  getPreviousSummerSchoolDate,
  isSummerSchoolActiveDate,
} from "../src/lib/summerSchoolCalendar.ts";

const cases = [
  ["Saturday uses Wednesday", "2026-07-11", "2026-07-08"],
  ["Friday uses Wednesday", "2026-07-10", "2026-07-08"],
  ["Thursday uses Wednesday", "2026-07-09", "2026-07-08"],
  ["Wednesday uses Tuesday", "2026-07-08", "2026-07-07"],
  ["Tuesday uses Monday", "2026-07-07", "2026-07-06"],
  ["Monday uses previous Wednesday", "2026-07-06", "2026-07-01"],
] as const;

for (const [label, input, expected] of cases) {
  assert.equal(getPreviousSummerSchoolDate(input), expected, label);
}

assert.equal(isSummerSchoolActiveDate("2026-07-06"), true, "Monday is active");
assert.equal(isSummerSchoolActiveDate("2026-07-07"), true, "Tuesday is active");
assert.equal(isSummerSchoolActiveDate("2026-07-08"), true, "Wednesday is active");
assert.equal(isSummerSchoolActiveDate("2026-07-09"), false, "Thursday is inactive");
assert.equal(isSummerSchoolActiveDate("2026-07-10"), false, "Friday is inactive");
assert.equal(isSummerSchoolActiveDate("2026-07-11"), false, "Saturday is inactive");

console.log("Summer school active-day tests passed.");
