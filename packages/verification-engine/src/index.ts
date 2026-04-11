export {
  computeScore,
  isVerified,
  buildSources,
  detectRiskFlags,
} from './scoring';

export type {
  VerificationInput,
  VerificationResult,
  RiskFlag,
  VerificationSource,
  ScoringWeights,
  PlanetVerificationAdapter,
} from './types';

export { DEFAULT_SCORING_WEIGHTS } from './types';

// Re-export ScoreInputs from scoring for convenience
export type { ScoreInputs as ScoreInputsType } from './scoring';
