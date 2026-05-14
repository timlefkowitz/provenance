/** Tunable FFmpeg filter parameters (conservative defaults for speech / Voice Memos). */
export type AudioDenoiseOptions = {
  /** High-pass cutoff in Hz (removes rumble). */
  highpassHz?: number;
  /** afftdn noise floor in dB (more negative = stronger reduction). */
  afftdnNoiseFloorDb?: number;
  /** AAC bitrate for output, e.g. `160k`. */
  aacBitrate?: string;
};

export type AudioDenoiseInputMeta = {
  sizeBytes: number;
  mimeType: string;
  /** Safe extension including dot, e.g. `.m4a` */
  inputExtension: string;
};
