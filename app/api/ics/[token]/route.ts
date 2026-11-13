import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { formatRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Abo-Feed für den Apple Kalender: /api/ics/<token>
 * Der Token steht in den Einstellungen und kann dort neu erzeugt werden.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/ics/[token]">) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/, "");
  if (!/^[a-f0-9]{32,128}$/.test(token)) return new Response("Not found", { status: 404 });

  const sb = createAdminClient();
  const { data: settings } = await sb.from("settings").select("ics_token").eq("id", 1).single();
  if (!settings || settings.ics_token !== token) return new Response("Not found", { status: 404 });

  const [{ data: sessions, error }, { data: races }, { data: phases }] = await Promise.all([
    sb.from("planned_sessions").select("*").eq("cancelled", false).order("date"),
    sb.from("races").select("*"),
    sb.from("phases").select("id, name"),
  ]);
  if (error) return new Response("Fehler", { status: 500 });

  const phaseName = new Map((phases ?? []).map((p) => [p.id as string, p.name as string]));
  const events: IcsEvent[] = [];

  for (const s of sessions ?? []) {
    if (s.session_type === "race") continue; // Rennen kommen unten als mehrtägiges Ereignis
    const desc = [
      s.target_min != null ? `Ziel: ${formatRange(s.target_min, s.target_max)}` : null,
      s.phase_id ? phaseName.get(s.phase_id) : null,
      s.note,
    ].filter(Boolean);
    events.push({
      uid: `${s.slot_key.replace("|", "-")}@enduro-one-2027`,
      title: s.title,
      date: s.date,
      startTime: s.start_time?.slice(0, 5) ?? null,
      durationMin: s.target_max ?? 60,
      description: desc.join("\n"),
    });
  }
  for (const r of races ?? []) {
    events.push({
      uid: `race-${r.id}@enduro-one-2027`,
      title: `🏁 ${r.name}`,
      date: r.start_date,
      endDate: r.end_date,
      description: r.location ?? undefined,
    });
  }

  return new Response(buildIcs("Enduro One 2027", events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="enduro-one-2027.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
