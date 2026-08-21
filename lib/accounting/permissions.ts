export const ACCOUNTING_USER_EMAIL = "contabilitate@elmont.ro";

export function canAccessAccounting(session: unknown) {
  const value = session as { role?: string; user?: { email?: string | null } } | null;
  return value?.role === "SUPER_ADMIN" || value?.user?.email?.toLowerCase() === ACCOUNTING_USER_EMAIL;
}