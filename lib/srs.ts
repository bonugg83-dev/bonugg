export type Rating = "again" | "hard" | "good" | "easy";

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
}

export const DEFAULT_EASE_FACTOR = 2.5;
export const MAX_INTERVAL_DAYS = 180;
export const DAILY_REVIEW_CAP = 50;
const MIN_EASE_FACTOR = 1.3;

export function applyReview(state: SrsState, rating: Rating): SrsState {
  const base = Math.max(state.intervalDays, 1);
  let easeFactor = state.easeFactor;
  let intervalDays: number;

  switch (rating) {
    case "again":
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      intervalDays = 1;
      break;
    case "hard":
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
      intervalDays = Math.round(base * 1.2);
      break;
    case "good":
      intervalDays = Math.round(base * easeFactor);
      break;
    case "easy":
      easeFactor = easeFactor + 0.15;
      intervalDays = Math.round(base * easeFactor * 1.3);
      break;
  }

  intervalDays = Math.min(Math.max(intervalDays, 1), MAX_INTERVAL_DAYS);
  return { easeFactor, intervalDays };
}

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}
