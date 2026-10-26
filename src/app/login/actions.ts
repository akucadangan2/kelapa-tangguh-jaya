"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { run, s, type ActionState } from "@/lib/action";

export async function login(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: s(fd, "email")!, password: String(fd.get("password") ?? "") });
    if (error) throw new Error("Email atau password salah");
    redirect("/dashboard");
  });
}
