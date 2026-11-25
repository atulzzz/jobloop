# 数据模型

## 核心实体

```text
CandidateProfile
ResumeDocument
JobPosting
MatchReport
OutreachMessage
Application
InteractionEvent
InterviewSession
AgentRun
```

## CandidateProfile

```text
id
displayName
targetRoles[]
locations[]
salaryExpectation
seniority
skills[]
experiences[]
projects[]
achievements[]
gapExplanation
preferences
evidenceRefs[]
version
confirmedAt
createdAt
updatedAt
```

画像中的事实必须能够追溯到简历证据。

## ResumeDocument

```text
id
fileName
fileType
contentHash
extractedText
createdAt
```

## JobPosting

```text
id
source
sourceJobId
url
companyName
title
salaryText
salaryMin
salaryMax
location
seniority
description
requirements[]
skills[]
capturedAt
extractionConfidence
rawSnapshotId
```

`JobPosting` 表示岗位本身；同一岗位可对应多次投递或沟通。

## MatchReport

```text
id
candidateProfileId
jobPostingId
hardConstraintResult
dimensionScores
totalScore
confidence
evidence[]
risks[]
recommendation
scoringVersion
createdAt
```

## Application

```text
id
jobPostingId
candidateProfileId
status
source
appliedAt
lastContactAt
nextAction
nextActionAt
notes
createdAt
updatedAt
```

## InteractionEvent

```text
id
applicationId
type
channel
summary
occurredAt
metadata
```

## InterviewSession

```text
id
jobPostingId
candidateProfileId
interviewerSkill
status
startedAt
endedAt
transcript[]
scorecard
```

## AgentRun

```text
id
sessionId
goal
model
status
toolCalls[]
approvals[]
errors[]
startedAt
endedAt
```

## Excel 导入

现有公司沟通表不直接作为运行时数据源。

导入流程：

```text
选择 Excel
→ 预览列映射
→ 创建导入批次
→ 转换 Company/JobPosting/Application/InteractionEvent
→ 校验重复项
→ 用户确认导入
→ 保存导入报告
```

必须保留：

- 原始文件名
- 原始行号
- 导入批次 ID
- 原始关键字段的只读快照
- 转换警告和错误

Excel 可以作为导出格式，但数据库是应用运行时的事实来源。
