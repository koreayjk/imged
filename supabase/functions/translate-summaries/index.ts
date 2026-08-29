// 강의 요약 번역 — 칸 아카데미 영어 설명을 학생 모국어(ko/zh/th)로 옮긴다.
// 관리자만 호출 가능. 한 번에 배치 단위로 처리하고, 이미 번역된 영상은 건너뛴다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];
const LANGS = ["ko", "zh", "th"] as const;
const LANG_NAME: Record<string, string> = {
  ko: "Korean", zh: "Simplified Chinese", th: "Thai",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Item { youtube_id: string; title: string; en: string }

function buildPrompt(items: Item[]): string {
  const list = items.map((it, i) =>
    `${i + 1}. [${it.youtube_id}] "${it.title}"\n${it.en}`).join("\n\n");
  return `You are translating short lesson summaries for a GED self-study app.
The students are teenagers in Chiang Mai, Thailand, studying for the US GED exam.
Their English is still developing, so the translation must be plain and concrete.

Rules:
- Translate the summary into ${LANGS.map((l) => LANG_NAME[l]).join(", ")}.
- Keep it to 1-2 sentences. Do not add information that is not in the source.
- Keep mathematical and scientific terms accurate; where a term is commonly used in
  English in that language's classrooms, keep the English term in parentheses.
- Natural classroom register, not literal word-for-word translation.
- Do not translate the video title or the id.

Summaries:

${list}`;
}

const SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          youtube_id: { type: "string" },
          ko: { type: "string" },
          zh: { type: "string" },
          th: { type: "string" },
        },
        required: ["youtube_id", "ko", "zh", "th"],
      },
    },
  },
  required: ["translations"],
};

async function callGemini(apiKey: string, prompt: string) {
  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            temperature: 0.2,
          },
        }),
      },
    );
    if (!res.ok) { lastErr = `${model}: ${res.status} ${await res.text()}`; continue; }
    const body = await res.json();
    const parts = body?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "").join("");
    if (!text) { lastErr = `${model}: empty output`; continue; }
    try { return { model, data: JSON.parse(text) }; }
    catch { lastErr = `${model}: unparseable JSON`; }
  }
  throw new Error(`gemini failed — ${lastErr}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // items: 앱이 번들에서 읽어 보내는 미번역 영상 목록 (한 번에 최대 40편)
    const { items } = await req.json() as { items?: Item[] };
    if (!Array.isArray(items) || items.length === 0) return json({ error: "no_items" }, 400);
    const batch = items.slice(0, 40);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "admin") return json({ error: "admin_only" }, 403);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

    // 이미 번역된 것은 제외 (중복 호출로 무료 한도를 낭비하지 않도록)
    const ids = batch.map((i) => i.youtube_id);
    const { data: done } = await supabase
      .from("video_summaries").select("youtube_id").in("youtube_id", ids);
    const already = new Set((done ?? []).map((r) => r.youtube_id));
    const todo = batch.filter((i) => !already.has(i.youtube_id));
    if (todo.length === 0) return json({ translated: 0, skipped: batch.length });

    const { model, data } = await callGemini(apiKey, buildPrompt(todo));
    const bySrc = new Map(todo.map((i) => [i.youtube_id, i]));
    const rows = [];
    for (const tr of (data?.translations ?? []) as Record<string, string>[]) {
      if (!bySrc.has(tr.youtube_id)) continue;                   // 없는 id 응답은 버림
      if (!LANGS.every((l) => (tr[l] ?? "").trim().length > 4)) continue;
      rows.push({
        youtube_id: tr.youtube_id,
        summary_i18n: { ko: tr.ko.trim(), zh: tr.zh.trim(), th: tr.th.trim() },
        model,
        translated_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await supabase.from("video_summaries").upsert(rows);
      if (error) return json({ error: error.message }, 500);
    }
    return json({ translated: rows.length, skipped: batch.length - todo.length, model });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
