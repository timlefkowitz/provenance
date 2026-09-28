export const REPORT_TARGET_TYPES = ['artwork', 'collectible', 'profile', 'exhibition', 'user'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  { value: 'offensive', label: 'Hateful or offensive' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'sexual', label: 'Sexual or explicit content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'ip_infringement', label: 'Copyright or stolen artwork' },
  { value: 'impersonation', label: 'Impersonation or fake profile' },
  { value: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['value'];
