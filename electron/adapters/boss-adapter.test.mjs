import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createJobPosting } from "../job-model.mjs";
import {
  extractBossJob,
  isBossJobUrl
} from "./boss-adapter.mjs";

const JOB_URL =
  "https://www.zhipin.com/job_detail/d1db380519db09e00nR909m0ElBT.html";
const CAPTURED_AT = "2026-11-26T08:00:00.000Z";

function fixture(name) {
  return fs.readFileSync(
    new URL(`../../test/fixtures/boss/${name}`, import.meta.url),
    "utf8"
  );
}

test("createJobPosting provides stable defaults", () => {
  const job = createJobPosting({
    source: "manual",
    title: "前端开发工程师"
  });

  assert.equal(job.schemaVersion, 1);
  assert.equal(job.source, "manual");
  assert.equal(job.title, "前端开发工程师");
  assert.equal(job.salaryText, "");
  assert.equal(job.salaryStatus, "missing");
  assert.equal(job.pageKind, "unknown");
  assert.deepEqual(job.skills, []);
  assert.ok(Array.isArray(job.missingFields));
});

test("isBossJobUrl accepts detail and job search pages", () => {
  assert.equal(isBossJobUrl(JOB_URL), true);
  assert.equal(
    isBossJobUrl("https://m.zhipin.com/job_detail/example.html"),
    true
  );
  assert.equal(
    isBossJobUrl(
      "https://www.zhipin.com/web/geek/job?query=frontend&city=101280600"
    ),
    true
  );
  assert.equal(
    isBossJobUrl("https://example.com/job_detail/example.html"),
    false
  );
});

test("extractBossJob extracts a readable job posting", () => {
  const job = extractBossJob({
    html: fixture("job-normal.html"),
    url: JOB_URL,
    capturedAt: CAPTURED_AT
  });

  assert.equal(job.schemaVersion, 1);
  assert.equal(job.source, "boss");
  assert.equal(job.sourceJobId, "d1db380519db09e00nR909m0ElBT");
  assert.equal(job.sourceUrl, JOB_URL);
  assert.equal(job.pageUrl, JOB_URL);
  assert.equal(job.pageKind, "detail");
  assert.equal(job.title, "前端开发工程师-AI agent");
  assert.equal(job.company, "某知名互联网上市公司");
  assert.equal(job.city, "深圳");
  assert.equal(job.salaryText, "35-65K·16薪");
  assert.equal(job.salaryStatus, "readable");
  assert.equal(job.experience, "3-5年");
  assert.equal(job.education, "本科");
  assert.deepEqual(job.skills, [
    "JavaScript",
    "HTML5",
    "Vue",
    "AI agent",
    "Node.js",
    "React"
  ]);
  assert.match(job.description, /岗位职责/);
  assert.match(job.description, /任职要求/);
  assert.equal(job.capturedAt, CAPTURED_AT);
});

test("extractBossJob reads the selected job from a search page", () => {
  const searchUrl =
    "https://www.zhipin.com/web/geek/job?query=frontend&city=101280600";
  const job = extractBossJob({
    html: fixture("job-search-selected.html"),
    url: searchUrl,
    capturedAt: CAPTURED_AT
  });

  assert.equal(job.pageKind, "search-result");
  assert.equal(job.pageUrl, searchUrl);
  assert.equal(job.sourceJobId, "search_job_002");
  assert.equal(
    job.sourceUrl,
    "https://www.zhipin.com/job_detail/search_job_002.html"
  );
  assert.equal(job.title, "高级前端工程师");
  assert.equal(job.company, "搜索页示例科技");
  assert.equal(job.city, "深圳");
  assert.equal(job.salaryText, "");
  assert.equal(job.salaryStatus, "unreadable");
  assert.equal(job.experience, "3-5年");
  assert.equal(job.education, "本科");
  assert.deepEqual(job.skills, ["React", "TypeScript", "Node.js"]);
  assert.match(job.description, /搜索业务前端架构/);
  assert.match(job.description, /前端工程化/);
  assert.equal(job.description.includes("BOSS直聘"), false);
});

test("extractBossJob marks SVG-obfuscated salary as unreadable", () => {
  const job = extractBossJob({
    html: fixture("job-hidden-salary.html"),
    url: JOB_URL,
    capturedAt: CAPTURED_AT
  });

  assert.equal(job.salaryText, "");
  assert.equal(job.salaryStatus, "unreadable");
  assert.equal(job.missingFields.includes("salary"), false);
});

test("extractBossJob never returns private-use salary glyphs", () => {
  const job = extractBossJob({
    html: fixture("job-private-glyph-salary.html"),
    url: JOB_URL,
    capturedAt: CAPTURED_AT
  });

  assert.equal(job.salaryText, "");
  assert.equal(job.salaryStatus, "unreadable");
  assert.equal(/[\uE000-\uF8FF]/u.test(JSON.stringify(job)), false);
});

test("extractBossJob records missing fields", () => {
  const job = extractBossJob({
    html: fixture("job-missing-fields.html"),
    url: JOB_URL,
    capturedAt: CAPTURED_AT
  });

  assert.equal(job.title, "前端开发工程师");
  assert.equal(job.salaryStatus, "missing");
  assert.ok(job.missingFields.includes("company"));
  assert.ok(job.missingFields.includes("city"));
  assert.ok(job.missingFields.includes("salary"));
  assert.ok(job.missingFields.includes("experience"));
  assert.ok(job.missingFields.includes("education"));
  assert.ok(job.missingFields.includes("skills"));
});

test("extractBossJob rejects non-BOSS pages", () => {
  assert.throws(
    () =>
      extractBossJob({
        html: "<h1>Frontend Engineer</h1>",
        url: "https://example.com/job/1",
        capturedAt: CAPTURED_AT
      }),
    /BOSS/
  );
});
