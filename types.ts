export enum AppState {
  INTRO = 'INTRO',
  GENERATING_SCENE = 'GENERATING_SCENE',
  SELECTING_LINE = 'SELECTING_LINE',
  RECITING = 'RECITING',
  ERROR = 'ERROR'
}

export interface FocusPointData {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  text: string;
  feature: string; // Visual description of the object
}

export interface HaikuContext {
  theme: string;
  line1?: string;
  line2?: string;
  line3?: string;
}

export interface GeneratedAsset {
  imageBase64: string;
  options: string[];
}