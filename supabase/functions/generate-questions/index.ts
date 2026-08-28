// GED 문항 AI 대량 생성 — Supabase Edge Function (Deno)
// 공식 GED 시험 사양(assessment targets, 도메인 비중, 출제 스타일)을 사양서로 삼아
// Gemini가 새 문항을 생성하고, 자동 검증 통과분만 questions 테이블에 status='draft'로 저장.
// 공식 문항을 복제하지 않는다.
//
// 배포:  대시보드 → Edge Functions → New function "generate-questions" → 이 파일 붙여넣기 → Deploy
// 시크릿: GEMINI_API_KEY (에세이 채점과 공유)
//
// 요청(POST, 관리자 JWT 필요): { subject: "math"|"rla"|"science"|"social", count?: number }
// 응답: { generated, rejected, samples, model, subject }

import { createClient } from "npm:@supabase/supabase-js@2";

const MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];
const geminiUrl = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// ───────────────────────────────── 공식 시험 사양 (blueprint)
const SUBJECT_SPEC: Record<string, {
  name: string;
  domains: { label: string; weight: number }[];
  style: string[];
}> = {
  math: {
    name: "Mathematical Reasoning",
    domains: [
      { label: "Quantitative problem solving", weight: 0.45 },
      { label: "Algebraic problem solving", weight: 0.55 },
    ],
    style: [
      "Use real-life contexts (shopping, wages, distance, area, discounts, utility bills).",
      "Multi-step (2-3 step) computation is the norm; keep single-step items under 20%.",
      "Build distractors from common errors: sign errors, order-of-operations slips, unit conversion misses, reciprocal confusion.",
      "Keep numbers manageable without a calculator.",
    ],
  },
  rla: {
    name: "Reasoning Through Language Arts",
    domains: [
      { label: "Informational text comprehension", weight: 0.55 },
      { label: "Literary text comprehension", weight: 0.2 },
      { label: "Language conventions and usage", weight: 0.25 },
    ],
    style: [
      "For reading items, include an 80-150 word passage in stimulus_en (workplace notice, news article, speech, letter, or literary excerpt).",
      "Ask about main idea, inference, supporting detail, author's purpose, tone, and vocabulary in context.",
      "For grammar items, present a sentence and ask which word/phrase correctly completes it (subject-verb agreement, pronouns, modifiers, punctuation, commonly confused words).",
    ],
  },
  science: {
    name: "Science",
    domains: [
      { label: "Life science", weight: 0.4 },
      { label: "Physical science", weight: 0.4 },
      { label: "Earth and space science", weight: 0.2 },
    ],
    style: [
      "Every item must include a short stimulus in stimulus_en: a 60-120 word passage, a simple data table written as plain text, or an experiment description.",
      "Test interpretation, not memorization: reading data, identifying variables, evaluating experimental design, judging whether a conclusion is supported.",
      "Keep any numbers simple enough for mental arithmetic.",
    ],
  },
  social: {
    name: "Social Studies",
    domains: [
      { label: "Civics and government", weight: 0.5 },
      { label: "United States history", weight: 0.2 },
      { label: "Economics", weight: 0.15 },
      { label: "Geography and the world", weight: 0.15 },
    ],
    style: [
      "Every item must include a short stimulus in stimulus_en: an excerpt from a founding document, a speech, a news-style paragraph, or a small data table as plain text.",
      "Ask about point of view, purpose, reliability of a source, cause and effect, and interpreting data — not rote facts.",
      "US government structure (separation of powers, checks and balances, Bill of Rights) is the most frequently tested topic.",
    ],
  },
};

// 수학 공식 assessment targets (GED Assessment Guide for Educators)
const MATH_TARGETS: [string, string][] = [
  ["Q.1.b", "Apply number properties involving multiples and factors, such as using the least common multiple, greatest common factor, or distributive property."],
  ["Q.1.c", "Apply rules of exponents in numerical expressions with rational exponents to write equivalent expressions."],
  ["Q.1.d", "Identify absolute value of a rational number as its distance from 0 on the number line and determine distance between two rational numbers."],
  ["Q.2.a", "Perform addition, subtraction, multiplication, and division on rational numbers."],
  ["Q.2.b", "Perform computations and write numerical expressions with squares and square roots of positive rational numbers."],
  ["Q.2.e", "Solve one-step or multi-step arithmetic, real-world problems involving the four operations with rational numbers, including scientific notation."],
  ["Q.3.a", "Compute unit rates (unit pricing, constant speed, persons per square mile, BTUs per cubic foot)."],
  ["Q.3.b", "Use scale factors to determine the magnitude of a size change; convert between actual and scale drawings."],
  ["Q.3.c", "Solve multistep, arithmetic, real-world problems using ratios or proportions, including converting units of measure."],
  ["Q.3.d", "Solve two-step, arithmetic, real-world problems involving percents (simple interest, tax, markups/markdowns, gratuities, commissions, percent increase/decrease)."],
  ["Q.5.a", "Compute the perimeter and area of polygons, including composite figures."],
  ["Q.5.b", "Compute the circumference and area of circles, including composite figures."],
  ["Q.5.c", "Compute the perimeter and area of two-dimensional composite shapes, including circles."],
  ["Q.5.d", "Compute the surface area and volume of rectangular prisms, cylinders, pyramids, cones, and spheres."],
  ["Q.5.e", "Compute surface area and volume of composite three-dimensional figures."],
  ["Q.5.f", "Use the Pythagorean theorem to determine unknown side lengths in a right triangle."],
  ["Q.6.b", "Represent, display, and interpret categorical data in bar graphs or circle graphs."],
  ["Q.6.c", "Represent, display, and interpret data involving one-variable data (dot plots, histograms, box plots) or two-variable data (scatter plots)."],
  ["Q.7.a", "Calculate and use the mean, median, mode, and range of a data set; determine the effect of outliers."],
  ["Q.8.a", "Use counting techniques to solve problems and determine combinations and permutations."],
  ["Q.8.b", "Determine the probability of simple and compound events."],
  ["A.1.a", "Add, subtract, factor, multiply, and expand linear expressions with rational coefficients."],
  ["A.1.b", "Evaluate linear expressions by substituting integers for unknown quantities."],
  ["A.1.c", "Write linear expressions as part of word-to-symbol translations or to represent common settings."],
  ["A.1.d", "Add, subtract, multiply polynomials, including multiplying two binomials, or divide factorable polynomials."],
  ["A.1.e", "Evaluate polynomial expressions by substituting integers for unknown quantities."],
  ["A.1.f", "Factor polynomial expressions."],
  ["A.2.a", "Solve one-variable linear equations with rational number coefficients, including equations whose solutions require expanding expressions."],
  ["A.2.b", "Solve one-variable linear inequalities and graph the solution on a number line."],
  ["A.2.c", "Write linear equations to represent real-world situations that involve a single unknown quantity."],
  ["A.2.d", "Write linear inequalities to represent context and solve them."],
  ["A.3.a", "Solve real-world problems involving simple interest, distance-rate-time, or similar linear relationships."],
  ["A.3.b", "Solve a system of two simultaneous linear equations by substitution, elimination, or graphing."],
  ["A.3.c", "Write a system of two simultaneous linear equations to represent a real-world context."],
  ["A.5.b", "Determine the slope of a line from a graph, equation, or table."],
  ["A.5.c", "Interpret unit rate as the slope in a proportional relationship."],
  ["A.5.d", "Graph two-variable linear equations."],
  ["A.5.e", "Use slope to identify parallel and perpendicular lines and solve related geometric problems."],
  ["A.6.b", "Write the equation of a line with a given slope through a given point, or through two given points."],
  ["A.6.c", "Use the relationship between two lines to determine whether they are parallel, perpendicular, or neither."],
  ["A.7.a", "Compare two different proportional relationships represented in different ways (e.g. a distance-time graph vs. an equation)."],
  ["A.7.b", "Represent or identify a function in a table or graph as having exactly one output for each input."],
  ["A.7.c", "Evaluate linear and quadratic functions for values in the domain, including in real-world problems."],
  ["A.7.d", "Compare properties of two linear or quadratic functions represented in different ways (table, graph, equation, verbal description)."],
];

const QUALITY_RULES = [
  "Exactly one option is unambiguously correct.",
  "All four options are similar in length and form. Never use 'all of the above' or 'none of the above'.",
  "The explanation says why the answer is right AND names the misconception behind the wrong options.",
  "Korean text must read naturally for a teenage learner — never machine-translation style.",
  "Do NOT reproduce any official GED item. Invent new numbers, contexts, and wording.",
  "Students are multinational teens: avoid culture-specific slang and idioms.",
];

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          skill_tag: { type: "STRING", description: "lowercase-hyphenated topic slug" },
          ged_target: { type: "STRING", description: "official target code like Q.2.a, or domain name for non-math" },
          difficulty: { type: "INTEGER", description: "1-4" },
          dok: { type: "INTEGER", description: "Depth of Knowledge 1-3" },
          stimulus_en: { type: "STRING", description: "short passage/table if needed, else empty string" },
          stimulus_ko: { type: "STRING" },
          stem_en: { type: "STRING" },
          stem_ko: { type: "STRING" },
          choices_en: { type: "ARRAY", items: { type: "STRING" }, description: "exactly 4" },
          answer_index: { type: "INTEGER", description: "0-3" },
          explanation_en: { type: "STRING" },
          explanation_ko: { type: "STRING" },
          distractor_rationale: { type: "STRING" },
        },
        required: ["skill_tag", "ged_target", "difficulty", "dok", "stem_en", "stem_ko",
                   "choices_en", "answer_index", "explanation_en", "explanation_ko"],
      },
    },
  },
  required: ["questions"],
};

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function buildPrompt(subject: string, batchSize: number, targets: [string, string][], existing: string[]) {
  const spec = SUBJECT_SPEC[subject];
  const lines = [
    `You are a senior GED® item writer for ${spec.name}.`,
    "",
    "## Test specification (official blueprint — use as a SPEC, never copy official items)",
    "- Domains: " + spec.domains.map((d) => `${d.label} ${Math.round(d.weight * 100)}%`).join(", "),
    "- Write MULTIPLE-CHOICE items with exactly 4 options.",
    "",
    "## Style rules (from the official assessment guide)",
    ...spec.style.map((s) => `- ${s}`),
  ];
  if (targets.length) {
    lines.push("", "## Assessment targets to cover in this batch (put the exact code in ged_target)");
    for (const [code, desc] of targets) lines.push(`- ${code}: ${desc}`);
  } else {
    lines.push("", "## Coverage", "- Spread items across the domains above in proportion to their weights.",
      "- Put the domain name in ged_target.");
  }
  lines.push("", "## Quality rules", ...QUALITY_RULES.map((r) => `- ${r}`));
  lines.push("", "## Output requirements",
    `- Produce exactly ${batchSize} NEW questions.`,
    "- stem_en / choices_en / explanation_en in English; stem_ko / explanation_ko in natural Korean.",
    "- stimulus_en: include a short passage/table/scenario when the item needs one; otherwise empty string. stimulus_ko is its Korean rendering.",
    "- skill_tag: lowercase-hyphenated topic slug (e.g. 'ratios-rates', 'reading-inference', 'cells-organisms', 'civics-branches').",
    "- Vary numbers, contexts, and difficulty. Never reuse a scenario twice.",
    "- Verify every computation and answer before writing it.");
  if (existing.length) {
    lines.push("", "## Already in the bank — write DIFFERENT items (do not paraphrase these)");
    for (const s of existing.slice(0, 30)) lines.push(`- ${s}`);
  }
  return lines.join("\n");
}

async function callGemini(apiKey: string, prompt: string) {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.95,
      maxOutputTokens: 32000,
    },
  });
  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch(geminiUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
    });
    if (res.status === 404) { lastErr = `${model}: 404`; continue; }
    if (!res.ok) { lastErr = `${model}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`; continue; }
    const payload = await res.json();
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text).join("");
    if (!text) { lastErr = `${model}: empty (${payload?.candidates?.[0]?.finishReason})`; continue; }
    try {
      return { model, data: JSON.parse(text) };
    } catch {
      lastErr = `${model}: non-JSON output`;
    }
  }
  throw new Error(lastErr || "gemini call failed");
}

interface RawQ {
  skill_tag: string; ged_target?: string; difficulty?: number; dok?: number;
  stimulus_en?: string; stimulus_ko?: string; stem_en: string; stem_ko: string;
  choices_en: string[]; answer_index: number;
  explanation_en: string; explanation_ko: string; distractor_rationale?: string;
}

function validate(q: RawQ, seen: Set<string>): string | null {
  const stem = (q.stem_en || "").trim();
  const ch = q.choices_en || [];
  if (stem.length < 10) return "stem too short";
  if (ch.length !== 4) return `choices != 4 (${ch.length})`;
  if (new Set(ch.map(norm)).size !== 4) return "duplicate choices";
  if (typeof q.answer_index !== "number" || q.answer_index < 0 || q.answer_index > 3) return "bad answer_index";
  for (const bad of ["all of the above", "none of the above"]) {
    if (ch.some((c) => c.toLowerCase().includes(bad))) return "forbidden choice text";
  }
  if (!(q.stem_ko || "").trim() || !(q.explanation_ko || "").trim()) return "missing Korean";
  if (!(q.explanation_en || "").trim()) return "missing English explanation";
  const key = norm(stem);
  if (seen.has(key)) return "duplicate of existing item";
  seen.add(key);
  return null;
}

function toRow(q: RawQ, subject: string) {
  const letters = ["a", "b", "c", "d"];
  let stemEn = q.stem_en.trim();
  let stemKo = q.stem_ko.trim();
  const stimEn = (q.stimulus_en || "").trim();
  const stimKo = (q.stimulus_ko || "").trim();
  if (stimEn) {
    stemEn = `${stimEn}\n\n${stemEn}`;
    stemKo = `${stimKo || stimEn}\n\n${stemKo}`;
  }
  return {
    subject,
    skill_tag: (q.skill_tag || "general").trim().toLowerCase(),
    ged_target: (q.ged_target || "").trim() || null,
    difficulty: Math.max(1, Math.min(5, Math.round(q.difficulty ?? 2))),
    dok: Math.max(1, Math.min(3, Math.round(q.dok ?? 2))),
    format: "mc",
    purpose: "practice",
    status: "draft",
    source: "ai-generated",
    stem_i18n: { en: stemEn, ko: stemKo },
    choices: q.choices_en.map((c, i) => ({ id: letters[i], text_i18n: { en: c.trim() } })),
    answer: { choice: letters[q.answer_index] },
    explanation_i18n: { en: q.explanation_en.trim(), ko: q.explanation_ko.trim() },
    distractor_rationale: (q.distractor_rationale || "").trim() || null,
  };
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { subject = "math", count = 24 } = await req.json();
    if (!SUBJECT_SPEC[subject]) return json({ error: "bad_subject" }, 400);
    const wanted = Math.max(4, Math.min(60, Number(count) || 24));

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

    // 중복 방지용 기존 문두 로드
    const { data: existingRows } = await supabase
      .from("questions").select("stem_i18n").eq("subject", subject).limit(600);
    const seen = new Set<string>();
    const existingStems: string[] = [];
    for (const r of existingRows ?? []) {
      const en = (r.stem_i18n as { en?: string })?.en ?? "";
      seen.add(norm(en));
      if (existingStems.length < 30) existingStems.push(en.split("\n").pop()!.slice(0, 90));
    }

    // 배치 구성: 수학은 타깃 그룹, 그 외는 단일 배치(도메인 비중 지시)
    const batches: { targets: [string, string][]; size: number }[] = [];
    if (subject === "math") {
      const perTarget = Math.max(1, Math.round(wanted / MATH_TARGETS.length));
      const groupSize = Math.max(3, Math.ceil(MATH_TARGETS.length / Math.ceil(wanted / (perTarget * 6))));
      for (let i = 0; i < MATH_TARGETS.length && batches.reduce((n, b) => n + b.size, 0) < wanted; i += groupSize) {
        const chunk = MATH_TARGETS.slice(i, i + groupSize);
        batches.push({ targets: chunk, size: Math.min(chunk.length * perTarget, wanted) });
      }
    } else {
      const per = 12;
      for (let done = 0; done < wanted; done += per) {
        batches.push({ targets: [], size: Math.min(per, wanted - done) });
      }
    }

    const rows: ReturnType<typeof toRow>[] = [];
    const rejected: { stem: string; why: string }[] = [];
    let usedModel = MODELS[0];

    for (const b of batches) {
      if (rows.length >= wanted) break;
      const prompt = buildPrompt(subject, b.size, b.targets, existingStems);
      let out;
      try {
        out = await callGemini(apiKey, prompt);
      } catch (e) {
        console.error("batch failed", (e as Error).message);
        continue;
      }
      usedModel = out.model;
      for (const q of (out.data?.questions ?? []) as RawQ[]) {
        if (rows.length >= wanted) break;
        const why = validate(q, seen);
        if (why) rejected.push({ stem: (q.stem_en || "").slice(0, 60), why });
        else rows.push(toRow(q, subject));
      }
    }

    if (!rows.length) {
      return json({ error: "no_questions_generated", rejected: rejected.slice(0, 5) }, 502);
    }

    const { error: insErr } = await supabase.from("questions").insert(rows);
    if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

    return json({
      subject,
      generated: rows.length,
      rejected: rejected.length,
      rejected_reasons: rejected.slice(0, 5),
      model: usedModel,
      samples: rows.slice(0, 3).map((r) => ({
        target: r.ged_target, skill: r.skill_tag,
        stem: r.stem_i18n.en.split("\n").pop()!.slice(0, 90),
      })),
    });
  } catch (e) {
    console.error("generate-questions error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
