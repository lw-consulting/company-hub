export interface BreakIntervalLike {
  startedAt: Date;
  endedAt: Date | null;
}

export interface BreakPolicy {
  companyThresholdMinutes?: number | null;
  companyMinBreakMinutes?: number | null;
}

export const AUSTRIAN_LEGAL_BREAK_THRESHOLD_MINUTES = 6 * 60;
export const AUSTRIAN_LEGAL_MIN_BREAK_MINUTES = 30;

export function calculateActualBreakMinutes(
  breaks: BreakIntervalLike[],
  asOf: Date = new Date(),
) {
  return Math.max(
    0,
    Math.round(
      breaks.reduce((total, current) => {
        const end = current.endedAt ?? asOf;
        const diff = (end.getTime() - current.startedAt.getTime()) / 60000;
        return total + Math.max(0, diff);
      }, 0),
    ),
  );
}

export function getRequiredBreakMinutes(durationMinutes: number, policy?: BreakPolicy) {
  let requiredMinutes = durationMinutes > AUSTRIAN_LEGAL_BREAK_THRESHOLD_MINUTES
    ? AUSTRIAN_LEGAL_MIN_BREAK_MINUTES
    : 0;

  if (
    policy?.companyThresholdMinutes !== undefined &&
    policy.companyThresholdMinutes !== null &&
    policy?.companyMinBreakMinutes !== undefined &&
    policy.companyMinBreakMinutes !== null &&
    durationMinutes >= policy.companyThresholdMinutes
  ) {
    requiredMinutes = Math.max(requiredMinutes, policy.companyMinBreakMinutes);
  }

  return requiredMinutes;
}

export function calculateBookedBreakMinutes(
  durationMinutes: number,
  actualBreakMinutes: number,
  policy?: BreakPolicy,
) {
  return Math.max(actualBreakMinutes, getRequiredBreakMinutes(durationMinutes, policy));
}
