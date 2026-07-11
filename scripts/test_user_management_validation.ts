import assert from "node:assert/strict";
import {
  isSupportedUserRole,
  normalizeEmail,
  normalizeFullName,
  normalizeIsActive,
  normalizeRole,
  normalizeTemporaryPassword,
} from "../supabase/functions/manage-users/userValidation.ts";

assert.equal(normalizeEmail("  TEST.User@Example.COM "), "test.user@example.com");
assert.throws(() => normalizeEmail("not-an-email"), /valid email/i);

assert.equal(normalizeFullName("  Mahbube   Şehzade "), "Mahbube Şehzade");
assert.throws(() => normalizeFullName("   "), /full name/i);

assert.equal(isSupportedUserRole("admin"), true);
assert.equal(isSupportedUserRole("staff"), true);
assert.equal(isSupportedUserRole("teacher"), true);
assert.equal(isSupportedUserRole("student"), true);
assert.equal(isSupportedUserRole("coordinator"), false);
assert.equal(normalizeRole("teacher"), "teacher");
assert.throws(() => normalizeRole("coordinator"), /role must be/i);

assert.equal(normalizeIsActive(undefined), true);
assert.equal(normalizeIsActive(false), false);
assert.throws(() => normalizeIsActive("yes"), /active status/i);

assert.equal(normalizeTemporaryPassword("temporary-123"), "temporary-123");
assert.throws(() => normalizeTemporaryPassword("short"), /at least 8/i);

console.log("User management validation tests passed.");
