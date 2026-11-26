import { load } from "cheerio";
import { createJobPosting } from "../job-model.mjs";
import { sanitizePageText } from "../page-sanitizer.mjs";

const BOSS_JOB_ID_PATTERN = /\/job_detail\/([^/?#]+)\.html/;

function getPageInfo(url) {
  let page;

  try {
    page = new URL(url);
  } catch {
    return null;
  }

  const isBossHost =
    page.hostname === "zhipin.com" ||
    page.hostname === "www.zhipin.com" ||
    page.hostname.endsWith(".zhipin.com");

  if (!isBossHost) {
    return null;
  }

  if (page.pathname.startsWith("/job_detail/")) {
    return { type: "detail", page };
  }

  if (page.pathname.startsWith("/web/geek/job")) {
    return { type: "search-result", page };
  }

  return null;
}

function cleanText(value) {
  return sanitizePageText(value).text.replace(/\s+/g, " ").trim();
}

function cleanDescriptionText(value) {
  return sanitizePageText(value)
    .text.replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstText($, root, selector) {
  return cleanText(root.find(selector).first().text());
}

function tagTexts($, root, selector) {
  return root
    .find(selector)
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);
}

function canonicalJobUrl(href, baseUrl) {
  const url = new URL(href, baseUrl);
  return `${url.origin}${url.pathname}`;
}

function extractJobId(url) {
  return new URL(url).pathname.match(BOSS_JOB_ID_PATTERN)?.[1] ?? "";
}

export function isBossJobUrl(url) {
  return getPageInfo(url) !== null;
}

export function extractBossJob({ html, url, capturedAt }) {
  const pageInfo = getPageInfo(url);

  if (!pageInfo) {
    throw new Error("Unsupported BOSS job page.");
  }

  const $ = load(html);
  const isSearchResult = pageInfo.type === "search-result";
  const contentRoot = isSearchResult
    ? $(".job-detail-box").first()
    : $("body");
  const banner = isSearchResult
    ? contentRoot.find(".job-detail-header").first()
    : $(".job-banner").first();
  const selectedCard = isSearchResult
    ? $(".job-card-wrap.active").first()
    : $();

  if (banner.length === 0) {
    throw new Error("Unable to locate the BOSS job detail panel.");
  }

  let jobHref = "";

  if (isSearchResult) {
    jobHref =
      contentRoot.find(".more-job-btn[href*='/job_detail/']").first().attr("href") ??
      contentRoot.find("a[href*='/job_detail/']").first().attr("href") ??
      selectedCard
        .find(".job-name[href*='/job_detail/']")
        .first()
        .attr("href") ??
      "";

    if (!jobHref) {
      const selectedJobId = selectedCard.attr("data-jobid");

      if (selectedJobId) {
        jobHref = `/job_detail/${selectedJobId}.html`;
      }
    }
  } else {
    jobHref = `${pageInfo.page.origin}${pageInfo.page.pathname}`;
  }

  const sourceUrl = jobHref ? canonicalJobUrl(jobHref, url) : "";
  const titleNode = isSearchResult
    ? banner.find(".job-detail-info .job-name").first()
    : banner.find("h1").first();
  const salaryNode = banner.find(".salary").first();
  const searchSalaryNode = isSearchResult
    ? banner.find(".job-detail-info .job-salary").first()
    : $();
  const effectiveSalaryNode =
    salaryNode.length > 0 ? salaryNode : searchSalaryNode;
  const rawSalary = effectiveSalaryNode.text().replace(/\s+/g, " ").trim();
  const sanitizedSalary = sanitizePageText(rawSalary);
  const hasHiddenSalary =
    effectiveSalaryNode.find(".zp-hide-salary").length > 0;
  const hasPrivateGlyphs =
    sanitizedSalary.privateUseCharacterCount > 0 ||
    sanitizedSalary.salaryObfuscated;
  const salaryStatus =
    effectiveSalaryNode.length === 0
      ? "missing"
      : /[0-9]/.test(sanitizedSalary.text) &&
          !hasHiddenSalary &&
          !hasPrivateGlyphs
        ? "readable"
        : "unreadable";
  const descriptionSelector = isSearchResult
    ? ".job-detail-body .desc"
    : ".job-detail-section .job-sec-text";
  const descriptionSegments = contentRoot
    .find(descriptionSelector)
    .map((_, element) => {
      const clone = $(element).clone();
      clone.find("span").remove();
      return cleanDescriptionText(clone.text());
    })
    .get()
    .filter(Boolean);
  const detailTags = tagTexts($, banner, ".tag-list li");
  const selectedCardTags = tagTexts($, selectedCard, ".tag-list li");
  const experience = isSearchResult
    ? detailTags[1] ?? selectedCardTags[0] ?? ""
    : firstText($, banner, ".text-experiece");
  const education = isSearchResult
    ? detailTags[2] ?? selectedCardTags[1] ?? ""
    : firstText($, banner, ".text-degree");
  const city = isSearchResult
    ? detailTags[0] ?? ""
    : firstText($, banner, ".text-city");
  const skills = isSearchResult
    ? selectedCardTags.slice(2)
    : tagTexts($, contentRoot, ".job-keyword-list li");
  const company = (
    isSearchResult
      ? firstText($, selectedCard, ".boss-name")
      : firstText($, banner, ".brand-name")
  )
    .replace(/^客户公司[：:]\s*/, "")
    .trim();

  return createJobPosting({
    source: "boss",
    sourceJobId: extractJobId(sourceUrl),
    sourceUrl,
    pageUrl: url,
    pageKind: pageInfo.type,
    title: cleanText(titleNode.attr("title") ?? titleNode.text()),
    company,
    city,
    salaryText: salaryStatus === "readable" ? sanitizedSalary.text : "",
    salaryStatus,
    experience,
    education,
    description: descriptionSegments.join("\n"),
    skills,
    capturedAt
  });
}
