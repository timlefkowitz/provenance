export type ActorType = 'artist' | 'gallery' | 'collector' | 'dealer' | 'owner' | 'appraiser';

export interface Actor {
  id: string;
  type: ActorType;
  name: string;
  reputation_score: number | null;
  verified: boolean;
  metadata: Record<string, unknown>;
}
