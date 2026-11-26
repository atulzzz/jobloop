function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.map(normalizeText).filter((skill) => skill.length > 0)
    )
  ];
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveSalaryStatus(draft, salaryText, errors) {
  if (salaryText) {
    if (!/\d/.test(salaryText)) {
      errors.salaryText = "请填写包含数字的薪资，例如 35-65K·16薪。";
      return "unreadable";
    }

    return "readable";
  }

  if (draft.salaryStatus === "unreadable") {
    return "unreadable";
  }

  return "missing";
}

function buildMissingFields(job) {
  const missingFields = [];

  if (!job.title) {
    missingFields.push("title");
  }
  if (!job.company) {
    missingFields.push("company");
  }
  if (!job.city) {
    missingFields.push("city");
  }
  if (job.salaryStatus === "missing") {
    missingFields.push("salary");
  }
  if (!job.experience) {
    missingFields.push("experience");
  }
  if (!job.education) {
    missingFields.push("education");
  }
  if (!job.description) {
    missingFields.push("description");
  }
  if (job.skills.length === 0) {
    missingFields.push("skills");
  }
  if (!job.sourceUrl) {
    missingFields.push("sourceUrl");
  }

  return missingFields;
}

export function validateJobConfirmation(draft, options = {}) {
  const errors = {};
  const job = {
    ...draft,
    schemaVersion: draft.schemaVersion ?? 1,
    pageKind: normalizeText(draft.pageKind) || "unknown",
    source: normalizeText(draft.source),
    sourceJobId: normalizeText(draft.sourceJobId),
    sourceUrl: normalizeText(draft.sourceUrl),
    pageUrl: normalizeText(draft.pageUrl),
    title: normalizeText(draft.title),
    company: normalizeText(draft.company),
    city: normalizeText(draft.city),
    salaryText: normalizeText(draft.salaryText),
    experience: normalizeText(draft.experience),
    education: normalizeText(draft.education),
    description: normalizeText(draft.description),
    skills: normalizeSkills(draft.skills),
    capturedAt: normalizeText(draft.capturedAt),
    confirmedAt: normalizeText(options.confirmedAt) || new Date().toISOString()
  };

  if (!job.title) {
    errors.title = "岗位标题不能为空。";
  }
  if (!job.company) {
    errors.company = "公司名称不能为空。";
  }
  if (!job.sourceUrl) {
    errors.sourceUrl = "来源 URL 不能为空。";
  } else if (!isValidHttpUrl(job.sourceUrl)) {
    errors.sourceUrl = "来源 URL 必须是有效的 HTTP 或 HTTPS 地址。";
  }

  job.salaryStatus = deriveSalaryStatus(
    draft,
    job.salaryText,
    errors
  );

  if (job.salaryStatus !== "readable") {
    job.salaryText = "";
  }

  job.missingFields = buildMissingFields(job);

  return {
    valid: Object.keys(errors).length === 0,
    job,
    errors
  };
}
