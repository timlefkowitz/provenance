/**
 * Institution setup: the short step after accepting an institution invite
 * (statement, logo, banner, privacy). Pure helpers shared by the setup page,
 * its save action, and the places that enforce the privacy answers.
 */

export type InstitutionTeamViewerRole = 'owner' | 'admin' | 'member';

export const MAX_INSTITUTION_STATEMENT_LENGTH = 4000;

/** Only owners and admins change setup answers; members see them read-only. */
export function canEditInstitutionSetup(role: InstitutionTeamViewerRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Existing works go private only when "keep works private" is switched on.
 * Switching it off changes the default for new works and leaves existing ones alone.
 */
export function shouldMakeExistingWorksPrivate(previous: boolean, next: boolean): boolean {
  return next && !previous;
}

/** Whether someone outside the team may see a profile's public page or site. */
export function isHiddenFromPublic(profile: {
  is_private?: boolean | null;
}): boolean {
  return profile.is_private === true;
}

/** Same-origin path of the setup page for an institution profile. */
export function institutionSetupPath(profileId: string): string {
  return `/profiles/${profileId}/setup`;
}
