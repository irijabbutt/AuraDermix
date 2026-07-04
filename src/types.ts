export type SkinType = "Oily" | "Dry" | "Combination" | "Sensitive" | "Normal";

export interface UserProfile {
  name: string;
  age: number;
  gender: string;
  skinType: SkinType;
  intolerantSubstances: string[];
  profilePicUrl?: string;
  subscriptionTier?: "Free" | "Pro" | "Elite";
}

export interface ScanMetrics {
  hydration: number; // 0-100%
  redness: number;   // 0-100%
  spots: number;     // raw count
  pores: number;     // 0-100%
  overallScore: number; // 0-100% skin health score
}

export interface SkincareRoutine {
  morning: string[];
  evening: string[];
}

export interface GeminiRecommendations {
  analysisSummary: string;
  severityLevel: "Mild" | "Moderate" | "Complex";
  nonMedicalRecommendations: string[];
  recommendedSkincareRoutine: SkincareRoutine;
  ingredientsToSeek: string[];
  ingredientsToAvoid: string[];
  lifestyleAdvice: string[];
  disclaimer: string;
}

export interface ScanReport {
  id: string;
  timestamp: string;
  detectedCondition: string;
  confidence: number;
  metrics: ScanMetrics;
  userProfile: UserProfile;
  recommendations?: GeminiRecommendations;
  imageUrl?: string;
}

export interface SkincareReminder {
  id: string;
  label: string;
  time: string; // "HH:MM"
  days: string[]; // ["Mon", "Tue", ...]
  active: boolean;
}

