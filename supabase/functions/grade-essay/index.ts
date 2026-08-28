// GED Extended Response(에세이) AI 채점 — Supabase Edge Function (Deno)
// 채점 엔진: Google Gemini 2.5 Flash (AI Studio 무료 티어 사용 가능)
//
// 배포:  supabase functions deploy grade-essay
//        (또는 대시보드 → Edge Functions → grade-essay → Code 에 이 파일 붙여넣기)
// 시크릿: supabase secrets set GEMINI_API_KEY=AIza...
//        (발급: https://aistudio.google.com/apikey — 무료 티어 제공)
//
// 요청(POST, 로그인 사용자 JWT 필요):
//   { promptId, promptTitle, passage, promptText, essay, nativeLang }
// 응답: { grade, wordCount } — essays 테이블에도 저장

import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Gemini responseSchema (OpenAPI 스타일) — 점수 JSON 형식을 강제한다
const TRAIT = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", description: "0, 1, or 2" },
    comment_en: { type: "STRING" },
    comment_native: { type: "STRING" },
  },
  required: ["score", "comment_en", "comment_native"],
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    trait1_arguments: TRAIT,
    trait2_development: TRAIT,
    trait3_conventions: TRAIT,
    total_score: { type: "INTEGER", description: "sum of the three trait scores, 0-6" },
    overall_en: { type: "STRING" },
    overall_native: { type: "STRING" },
    strengths_native: { type: "ARRAY", items: { type: "STRING" } },
    improvements_native: { type: "ARRAY", items: { type: "STRING" } },
    grammar_notes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          quote: { type: "STRING" },
          issue_native: { type: "STRING" },
          suggestion: { type: "STRING" },
        },
        required: ["quote", "issue_native", "suggestion"],
      },
    },
    next_steps_native: { type: "STRING" },
  },
  required: [
    "trait1_arguments", "trait2_development", "trait3_conventions",
    "total_score", "overall_en", "overall_native",
    "strengths_native", "improvements_native", "grammar_notes", "next_steps_native",
  ],
};

const LANG_NAME: Record<string, string> = {
  ko: "Korean", en: "English", zh: "Simplified Chinese", th: "Thai",
};

const SYSTEM = `You are an official GED RLA Extended Response scorer and a supportive writing tutor for teenage English learners.

Score the essay on the official GED three-trait rubric, each trait 0-2:
- Trait 1 (Creation of Arguments & Use of Evidence): Does the response create an argument based on the source text? Does it cite specific evidence from the passage? Is the stance clear?
- Trait 2 (Development of Ideas & Organizational Structure): Are ideas developed logically with a clear progression? Is there an intro/body/conclusion structure? Are transitions used?
- Trait 3 (Clarity & Command of Standard English Conventions): Sentence structure variety, grammar, usage, punctuation, spelling. Errors are acceptable if they don't impede understanding.

Scoring calibration: 0 = trait absent or minimal; 1 = partial/inconsistent; 2 = adequate for a first-draft 45-minute response (not a polished essay). An empty, off-topic, or copied response scores 0 across all traits. Each trait score must be exactly 0, 1, or 2, and total_score must equal their sum.

Feedback rules:
- comment_native / overall_native / strengths_native / improvements_native / grammar issue notes: write in the student's native language, warm but concrete, referencing what the student actually wrote.
- comment_en / overall_en: concise English versions.
- grammar_notes: quote up to 6 exact snippets from the essay with an error, explain the issue in the native language, and give the corrected English in "suggestion". If the essay has fewer errors, list fewer. 1 to 4 strengths, 1 to 5 improvements.
- next_steps_native: 2-3 sentences telling the student the single most valuable thing to practice next.`;

function clampTrait(t: { score: number }) {
  t.score = Math.max(0, Math.min(2, Math.round(Number(t.score) || 0)));
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { promptId, promptTitle, passage, promptText, essay, nativeLang } = await req.json();
    if (!essay || essay.trim().split(/\s+/).length < 20) {
      return json({ error: "essay_too_short" }, 400);
    }

    // 사용자 확인 (RLS 적용을 위해 사용자 JWT로 클라이언트 구성)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

    const langName = LANG_NAME[nativeLang] ?? "Korean";
    const userPrompt = `Student's native language: ${langName}

## Essay prompt: ${promptTitle}

## Source passage
${passage}

## Task given to the student
${promptText}

## Student's essay (unedited)
${essay}

Score this essay on the GED rubric and produce the structured feedback.`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: 8192,
          // 2.5 모델의 thinking 토큰이 출력 한도를 소진해 JSON이 잘리는 것 방지
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error("gemini error", geminiRes.status, detail.slice(0, 500));
      // 무료 티어 분당 한도(429) 등을 구분해 전달 + 원인 진단용 detail
      return json({
        error: geminiRes.status === 429 ? "rate_limited" : "grading_failed",
        detail: `gemini_http_${geminiRes.status}: ${detail.slice(0, 300)}`,
      }, 502);
    }

    const payload = await geminiRes.json();
    // thought 파트를 제외한 텍스트 파트만 수집
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join("");
    if (!text) {
      const finish = payload?.candidates?.[0]?.finishReason;
      console.error("gemini empty response", JSON.stringify(payload).slice(0, 500));
      return json({ error: "grading_failed", detail: `empty_output finishReason=${finish}` }, 502);
    }

    let grade;
    try {
      grade = JSON.parse(text);
    } catch {
      console.error("gemini non-JSON output", text.slice(0, 300));
      return json({ error: "grading_failed", detail: `non_json: ${text.slice(0, 200)}` }, 502);
    }

    // 점수 정합성 보정
    clampTrait(grade.trait1_arguments);
    clampTrait(grade.trait2_development);
    clampTrait(grade.trait3_conventions);
    grade.total_score =
      grade.trait1_arguments.score + grade.trait2_development.score + grade.trait3_conventions.score;

    const wordCount = essay.trim().split(/\s+/).length;
    await supabase.from("essays").insert({
      user_id: user.id,
      prompt_id: promptId ?? null,
      body: essay,
      word_count: wordCount,
      scores: {
        trait1: grade.trait1_arguments.score,
        trait2: grade.trait2_development.score,
        trait3: grade.trait3_conventions.score,
        total: grade.total_score,
      },
      feedback: grade,
      model: GEMINI_MODEL,
      graded_at: new Date().toISOString(),
    });

    return json({ grade, wordCount });
  } catch (e) {
    console.error("grade-essay error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
