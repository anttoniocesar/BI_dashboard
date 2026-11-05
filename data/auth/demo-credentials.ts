import type { DemoCredential } from "../../types/auth";

/** Development fixtures only. Replace this adapter with backend authentication later. */
export const demoCredentials: readonly DemoCredential[] = [
  { userId: "student-cesar", password: "demo123" },
  { userId: "teacher-neural", password: "demo123" },
  { userId: "admin-demo", password: "demo123" },
];
