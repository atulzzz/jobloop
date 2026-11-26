const SALARY_STATUS = Object.freeze({
  readable: "readable",
  unreadable: "unreadable",
  missing: "missing"
});

const VALID_SALARY_STATUSES = new Set(Object.values(SALARY_STATUS));

const STRING_FIELDS = [
  "source",
  "sourceJobId",
  "sourceUrl",
  "pageUrl",
  "title",
  "company",
  "city",
  "salaryText",
  "experience",
  "education",
  "description",
  "capturedAt"
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function deriveSalaryStatus(input, salaryText) {
  if (VALID_SALARY_STATUSES.has(input.salaryStatus)) {
    return input.salaryStatus;
  }

  if (!salaryText) {
    return SALARY_STATUS.missing;
  }

  return /\d/.test(salaryText)
    ? SALARY_STATUS.readable
    : SALARY_STATUS.unreadable;
}

export function createJobPosting(input = {}) {
  const job = {
    schemaVersion: 1,
    pageKind: normalizeText(input.pageKind) || "unknown"
  };

  for (const field of STRING_FIELDS) {
    job[field] = normalizeText(input[field]);
  }

  job.skills = Array.isArray(input.skills)
    ? [
        ...new Set(
          input.skills.map(normalizeText).filter((value) => value.length > 0)
        )
      ]
    : [];

  job.salaryStatus = deriveSalaryStatus(input, job.salaryText);

  if (job.salaryStatus !== SALARY_STATUS.readable) {
    job.salaryText = "";
  }

  const requiredContentFields = [
    "source",
    "sourceJobId",
    "sourceUrl",
    "pageUrl",
    "title",
    "company",
    "city",
    "experience",
    "education",
    "description"
  ];

  job.missingFields = requiredContentFields.filter(
    (field) => !job[field]
  );

  if (job.pageKind === "unknown") {
    job.missingFields.push("pageKind");
  }

  if (job.salaryStatus === SALARY_STATUS.missing) {
    job.missingFields.push("salary");
  }

  if (job.skills.length === 0) {
    job.missingFields.push("skills");
  }

  return job;
}
