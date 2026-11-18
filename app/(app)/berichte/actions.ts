"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { isISODate, todayISO } from "@/lib/dates";
import { generateDueReports, loadReportContext, savePhase, saveWeekly } from "@/lib/reports/service";
import type { FormResult } from "@/components/action-form";

export async function generateReportsAction(): Promise<FormResult> {
  const { supabase } = await requireUser();
  try {
    const r = await generateDueReports(supabase, todayISO());
    revalidatePath("/berichte", "layout");
    return { ok: r.message };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function regenerateWeeklyAction(weekStart: string): Promise<FormResult> {
  const { supabase } = await requireUser();
  if (!isISODate(weekStart)) return { error: "Ungültige Woche" };
  try {
    await saveWeekly(supabase, await loadReportContext(supabase, todayISO()), weekStart);
    revalidatePath("/berichte", "layout");
    return { ok: "Bericht neu berechnet und gespeichert." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function regeneratePhaseAction(phaseId: string): Promise<FormResult> {
  const { supabase } = await requireUser();
  try {
    await savePhase(supabase, await loadReportContext(supabase, todayISO()), phaseId);
    revalidatePath("/berichte", "layout");
    return { ok: "Phasenbericht neu berechnet und gespeichert." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
