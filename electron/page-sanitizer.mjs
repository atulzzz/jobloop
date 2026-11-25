export function sanitizePageText(rawText) {
  const privateUsePattern =
    /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu;
  let privateUseCharacterCount = 0;
  let salaryObfuscated = false;

  const lines = String(rawText ?? "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => {
      const matches = line.match(privateUsePattern) ?? [];

      if (matches.length === 0) {
        return line.replace(/[ \t]+/g, " ").trim();
      }

      privateUseCharacterCount += matches.length;

      if (/[0-9Kk万元薪]/u.test(line)) {
        salaryObfuscated = true;
        return "薪资：页面使用防抓取字符，需人工确认";
      }

      return line.replace(privateUsePattern, "").trim();
    })
    .filter((line, index, allLines) => {
      return line || (index > 0 && allLines[index - 1]);
    });

  return {
    text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    privateUseCharacterCount,
    salaryObfuscated
  };
}
