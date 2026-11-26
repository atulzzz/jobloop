export type JobConfirmationOptions = {
  confirmedAt?: string;
};

export type JobConfirmationResult = {
  valid: boolean;
  job: JobPosting;
  errors: Record<string, string>;
};

export function validateJobConfirmation(
  draft: JobPosting,
  options?: JobConfirmationOptions
): JobConfirmationResult;
