// GED Extended Response(에세이) AI 채점 — Supabase Edge Function (Deno)
//
// 배포:  supabase functions deploy grade-essay
//        (또는 대시보드 → Edge Functions → New function 에 이 파일 붙여넣기)
// 시크릿: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// 요청(POST, 로그인 사용자 JWT 필요):
//   { promptId, promptTitle, passage, promptText, essay, nativeLang }
// 응답: 채점 결과 JSON (essays 테이블에도 저장)

import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { createClient } from "npm:@supabase/supabase-js@2";

const GradeSchema = z.object({
  trait1_arguments: z.object({
    score: z.number().int().min(0).max(2),
    comment_en: z.string(),
    comment_native: z.string(),
  }),
  trait2_development: z.object({
    score: z.number().int().min(0).max(2),
    comment_en: z.string(),
    comment_native: z.string(),
  }),
  trait3_conventions: z.object({
    score: z.number().int().min(0).max(2),
    comment_en: z.string(),
    comment_native: z.string(),
  }),
  total_score: z.number().int().min(0).max(6),
  overall_en: z.string(),
  overall_native: z.string(),
  strengths_native: z.array(z.string()).min(1).max(4),
  improvements_native: z.array(z.string()).min(1).max(5),
  grammar_notes: z.array(z.object({
    quote: z.string(),
    issue_native: z.string(),
    suggestion: z.string(),
  })).max(6),
  next_steps_native: z.string(),
});

const LANG_NAME: Record<string, string> = {
  ko: "Korean", en: "English", zh: "Simplified Chinese", th: "Thai",
};

const SYSTEM = `You are an official GED RLA Extended Response scorer and a supportive writing tutor for teenage English learners.

Score the essay on the official GED three-trait rubric, each trait 0-2:
- Trait 1 (Creation of Arguments & Use of Evidence): Does the response create an argument based on the source text? Does it cite specific evidence from the passage? Is the stance clear?
- Trait 2 (Development of Ideas & Organizational Structure): Are ideas developed logically with a clear progression? Is there an intro/body/conclusion structure? Are transitions used?
- Trait 3 (Clarity & Command of Standard English Conventions): Sentence structure variety, grammar, usage, punctuation, spelling. Errors are acceptable if they don't impede understanding.

Scoring calibration: 0 = trait absent or minimal; 1 = partial/inconsistent; 2 = adequate for a first-draft 45-minute response (not a polished essay). An empty, off-topic, or copied response scores 0 across all traits.

Feedback rules:
- comment_native / overall_native / strengths / improvements / grammar issue notes: write in the student's native language, warm but concrete, referencing what the student actually wrote.
- comment_en / overall_en: concise English versions.
- grammar_notes: quote up to 6 exact snippets from the essay with an error, explain the issue in the native language, and give the corrected English in "suggestion". If the essay has fewer errors, list fewer.
- next_steps_native: 2-3 sentences telling the student the single most valuable thing to practice next.
- total_score must equal the sum of the three trait scores.`;

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { promptId, promptTitle, passage, promptText, essay, nativeLang } = await req.json();
    if (!essay || essay.trim().split(/\s+/).length < 20) {
      return new Response(JSON.stringify({ error: "essay_too_short" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 사용자 확인 (RLS 적용을 위해 사용자 JWT로 클라이언트 구성)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
    const langName = LANG_NAME[nativeLang] ?? "Korean";

    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Student's native language: ${langName}

## Essay prompt: ${promptTitle}

## Source passage
${passage}

## Task given to the student
${promptText}

## Student's essay (unedited)
${essay}

Score this essay on the GED rubric and produce the structured feedback.`,
      }],
      output_config: { format: zodOutputFormat(GradeSchema) },
    });

    const grade = response.parsed_output;
    if (!grade) {
      return new Response(JSON.stringify({ error: "grading_failed" }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

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
      model: "claude-opus-5",
      graded_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ grade, wordCount }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("grade-essay error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
