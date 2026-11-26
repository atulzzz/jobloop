import test from "node:test";
import assert from "node:assert/strict";
import { createJobPosting } from "../electron/job-model.mjs";
import { validateJobConfirmation } from "./job-confirmation.mjs";

const CONFIRMED_AT = "2026-11-26T09:30:00.000Z";

function baseDraft(overrides = {}) {
  return {
    ...createJobPosting({
      source: "boss",
      sourceJobId: "job_123",
      sourceUrl: "https://www.zhipin.com/job_detail/job_123.html",
      pageUrl: "https://www.zhipin.com/web/geek/jobs",
      pageKind: "search-result",
      title: "前端开发工程师",
      company: "示例科技",
      city: "深圳",
      salaryText: "",
      salaryStatus: "unreadable",
      experience: "3-5年",
      education: "本科",
      description: "负责 React 应用开发。",
      skills: ["React", "TypeScript"],
      capturedAt: "2026-11-26T09:00:00.000Z"
    }),
    ...overrides
  };
}

test("manual salary confirmation replaces unreadable status", () => {
  const result = validateJobConfirmation(
    baseDraft({ salaryText: " 35-65K·16薪 " }),
    { confirmedAt: CONFIRMED_AT }
  );

  assert.equal(result.valid, true);
  assert.equal(result.job.salaryText, "35-65K·16薪");
  assert.equal(result.job.salaryStatus, "readable");
  assert.equal(result.job.missingFields.includes("salary"), false);
  assert.equal(result.job.confirmedAt, CONFIRMED_AT);
});

test("empty unreadable salary stays unreadable after confirmation", () => {
  const result = validateJobConfirmation(baseDraft(), {
    confirmedAt: CONFIRMED_AT
  });

  assert.equal(result.valid, true);
  assert.equal(result.job.salaryStatus, "unreadable");
  assert.equal(result.job.salaryText, "");
  assert.equal(result.job.missingFields.includes("salary"), false);
});

test("empty missing salary stays missing", () => {
  const result = validateJobConfirmation(
    baseDraft({ salaryStatus: "missing" }),
    { confirmedAt: CONFIRMED_AT }
  );

  assert.equal(result.job.salaryStatus, "missing");
  assert.equal(result.job.missingFields.includes("salary"), true);
});

test("title and company are required", () => {
  const result = validateJobConfirmation(
    baseDraft({ title: " ", company: "" }),
    { confirmedAt: CONFIRMED_AT }
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.title, /标题/);
  assert.match(result.errors.company, /公司/);
});

test("source URL must be an HTTP or HTTPS URL", () => {
  const result = validateJobConfirmation(
    baseDraft({ sourceUrl: "javascript:alert(1)" }),
    { confirmedAt: CONFIRMED_AT }
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.sourceUrl, /URL/);
});

test("skills are trimmed, deduplicated and empty values removed", () => {
  const result = validateJobConfirmation(
    baseDraft({
      skills: [" React ", "TypeScript", "React", "", "Node.js"]
    }),
    { confirmedAt: CONFIRMED_AT }
  );

  assert.deepEqual(result.job.skills, ["React", "TypeScript", "Node.js"]);
});

test("missing optional content is reported without blocking confirmation", () => {
  const result = validateJobConfirmation(
    baseDraft({ city: "", skills: [] }),
    { confirmedAt: CONFIRMED_AT }
  );

  assert.equal(result.valid, true);
  assert.equal(result.job.missingFields.includes("city"), true);
  assert.equal(result.job.missingFields.includes("skills"), true);
});

test("confirmation does not mutate the input draft", () => {
  const draft = baseDraft({ skills: [" React "] });
  const snapshot = structuredClone(draft);

  validateJobConfirmation(draft, { confirmedAt: CONFIRMED_AT });

  assert.deepEqual(draft, snapshot);
});
