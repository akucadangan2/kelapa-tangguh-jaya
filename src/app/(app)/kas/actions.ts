"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, uploadAttachments, type ActionState } from "@/lib/action";

const refresh = () => revalidatePath("/kas", "layout");

export async function saveCashAccount(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const type = s(fd, "type")!;
    ok(await supabase.from("cash_accounts").insert({
      name: s(fd, "name"), type, bank_name: s(fd, "bank_name"), account_no: s(fd, "account_no"), coa_code: type === "bank" ? "1102" : "1101",
    }));
    refresh();
    return "Akun kas ditambahkan";
  });
}

export async function createTransfer(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const type = s(fd, "type") ?? "transfer";
    const { data, error } = await supabase.from("cash_transfers").insert({
      type,
      from_account_id: type === "capital_in" ? null : s(fd, "from_account_id"),
      to_account_id: type === "capital_out" ? null : s(fd, "to_account_id"),
      amount: n(fd, "amount"), transfer_date: s(fd, "transfer_date"), note: s(fd, "note"),
    }).select("id").single();
    if (error) throw new Error(error.message);
    const files = fd.getAll("files") as File[];
    if (files.some((f) => f.size)) {
      const { data: { user } } = await supabase.auth.getUser();
      await uploadAttachments(supabase, user!.id, files, "transfer", data.id, "transfer");
    }
    refresh();
    return "Transfer dicatat";
  });
}

export async function createExpense(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("expenses").insert({
      expense_date: s(fd, "expense_date"), category_id: s(fd, "category_id"), payee: s(fd, "payee"), amount: n(fd, "amount"),
      description: s(fd, "description"), cash_account_id: s(fd, "cash_account_id"), vehicle_id: s(fd, "vehicle_id"),
      trip_note: s(fd, "trip_note"), liters: n(fd, "liters"), people_count: n(fd, "people_count"), status: "valid",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await uploadAttachments(supabase, user!.id, fd.getAll("files") as File[], "expense", data.id, "receipt");
    refresh();
    return "Pengeluaran dicatat";
  });
}

export async function setExpenseStatus(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("expenses").update({ status: s(fd, "status"), review_note: s(fd, "note") }).eq("id", s(fd, "id")));
    refresh();
    return "Status pengeluaran diperbarui";
  });
}

export async function createPayroll(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const empId = s(fd, "employee_id");
    let name = s(fd, "employee_name");
    if (!name && empId) name = (await supabase.from("profiles").select("full_name").eq("id", empId).single()).data?.full_name ?? null;
    if (!name) throw new Error("Nama karyawan wajib diisi");
    ok(await supabase.from("payrolls").insert({
      employee_id: empId, employee_name: name, period: s(fd, "period"), gross_amount: n(fd, "gross_amount"),
      deductions: n(fd, "deductions") ?? 0, paid_at: s(fd, "paid_at"), cash_account_id: s(fd, "cash_account_id"), note: s(fd, "note"),
    }));
    refresh();
    return "Gaji dicatat";
  });
}

export async function createBonus(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const rid = s(fd, "recipient_id");
    let name = s(fd, "recipient_name");
    if (!name && rid) name = (await supabase.from("profiles").select("full_name").eq("id", rid).single()).data?.full_name ?? null;
    if (!name) throw new Error("Nama penerima wajib diisi");
    ok(await supabase.from("bonuses").insert({
      recipient_id: rid, recipient_name: name, reason: s(fd, "reason"), period: s(fd, "period"), amount: n(fd, "amount"),
      paid_at: s(fd, "paid_at"), cash_account_id: s(fd, "cash_account_id"),
    }));
    refresh();
    return "Bonus dicatat";
  });
}

export async function createReconciliation(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const acc = s(fd, "account_id")!;
    const end = s(fd, "period_end")!;
    const { data: trx } = await supabase.from("cash_transactions").select("direction, amount").eq("account_id", acc).lte("trx_date", end);
    const system = (trx ?? []).reduce((a: number, t: any) => a + (t.direction === "in" ? 1 : -1) * Number(t.amount), 0);
    ok(await supabase.from("bank_reconciliations").insert({
      account_id: acc, period_end: end, statement_balance: n(fd, "statement_balance"), system_balance: system, note: s(fd, "note"),
    }));
    refresh();
    return "Rekonsiliasi disimpan";
  });
}
