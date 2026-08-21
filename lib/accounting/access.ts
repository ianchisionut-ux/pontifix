import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessAccounting } from "@/lib/accounting/permissions";

export async function requireAccountingPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canAccessAccounting(session)) redirect("/dashboard");
  return session;
}

export function accountingApi<TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<Response>) {
  return async (...args: TArgs): Promise<Response> => {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    if (!canAccessAccounting(session)) {
      return NextResponse.json({ error: "Nu ai acces la modulul Contabilitate." }, { status: 403 });
    }
    return handler(...args);
  };
}