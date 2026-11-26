import type { ChangeEvent, FormEvent } from "react";

export type JobDraft = Omit<JobPosting, "skills"> & {
  skillsText: string;
};

type Props = {
  draft: JobDraft;
  errors: Record<string, string>;
  confirmed: boolean;
  onChange: (field: keyof JobDraft, value: string) => void;
  onConfirm: () => void;
};

function salaryStatusLabel(status: JobPosting["salaryStatus"]) {
  switch (status) {
    case "readable":
      return "已读取";
    case "unreadable":
      return "待人工确认";
    default:
      return "页面未提供";
  }
}

export function createJobDraft(job: JobPosting): JobDraft {
  return {
    ...job,
    skillsText: job.skills.join(", ")
  };
}

export default function JobConfirmationForm({
  draft,
  errors,
  confirmed,
  onChange,
  onConfirm
}: Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm();
  }

  function input(field: keyof JobDraft) {
    return {
      value: String(draft[field] ?? ""),
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        onChange(field, event.target.value)
    };
  }

  return (
    <form className="job-confirmation" onSubmit={handleSubmit}>
      <div className="structured-job-heading">
        <span>岗位确认</span>
        <span>
          {draft.pageKind === "search-result"
            ? "搜索页选中岗位"
            : "岗位详情页"}
        </span>
      </div>

      <label className="field">
        <span>岗位标题</span>
        <input {...input("title")} aria-invalid={Boolean(errors.title)} />
        {errors.title ? <small>{errors.title}</small> : null}
      </label>

      <label className="field">
        <span>公司</span>
        <input {...input("company")} aria-invalid={Boolean(errors.company)} />
        {errors.company ? <small>{errors.company}</small> : null}
      </label>

      <div className="field-grid">
        <label className="field">
          <span>城市</span>
          <input {...input("city")} />
        </label>
        <label className="field">
          <span>经验</span>
          <input {...input("experience")} />
        </label>
        <label className="field">
          <span>学历</span>
          <input {...input("education")} />
        </label>
      </div>

      <label className="field salary-field">
        <span>
          薪资
          <em>{salaryStatusLabel(draft.salaryStatus)}</em>
        </span>
        <input
          {...input("salaryText")}
          placeholder="例如 35-65K·16薪"
          aria-invalid={Boolean(errors.salaryText)}
        />
        {errors.salaryText ? <small>{errors.salaryText}</small> : null}
      </label>

      <label className="field">
        <span>技能标签</span>
        <input
          {...input("skillsText")}
          placeholder="React, TypeScript, Node.js"
        />
      </label>

      <label className="field">
        <span>岗位描述</span>
        <textarea
          value={draft.description}
          rows={6}
          onChange={(event) => onChange("description", event.target.value)}
        />
      </label>

      <div className="source-links">
        <div>
          <span>采集页面</span>
          <code title={draft.pageUrl}>{draft.pageUrl || "未记录"}</code>
        </div>
        <div>
          <span>规范岗位</span>
          <code title={draft.sourceUrl}>{draft.sourceUrl || "未记录"}</code>
        </div>
        {errors.sourceUrl ? <small>{errors.sourceUrl}</small> : null}
      </div>

      {draft.missingFields.length > 0 ? (
        <p className="missing-fields">
          待补充：{draft.missingFields.join("、")}
        </p>
      ) : null}

      <button className="confirm-job-button" type="submit">
        {confirmed ? "岗位已确认" : "确认岗位信息"}
      </button>
    </form>
  );
}
