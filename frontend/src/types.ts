export interface Place {
  id: number;
  title: string;
  description: string | null;
  lat: number;
  lon: number;
  radius_m: number;
  category: string | null;
  image_url: string | null;
}

export interface Challenge {
  id: number;
  title: string;
  description: string;
  story: string | null;
  day_number: number | null;
  start_at: string;
  end_at: string;
  points: number;
  category: string | null;
  is_active: boolean;
  is_mystery: boolean;
  is_task: boolean;
  is_photo: boolean;
  quiz_question?: string | null;
  quiz_options?: string[] | null;
  place: Place;
  user_checked_in?: boolean;
  checkin_count: number;
  first_day_active: boolean;
  mystery_attempts_left?: number | null;
  photo_submission_status?: "pending" | "approved" | "rejected" | null;
  photo_admin_message?: string | null;
}

// Bonuswerte – müssen mit backend/config.py übereinstimmen
export const BONUS_FIRST_CHECKIN = 5;
export const BONUS_FIRST_DAY = 5;

export function calcMaxPoints(c: Pick<Challenge, "points" | "checkin_count" | "first_day_active">): number {
  return (
    c.points +
    (c.checkin_count === 0 ? BONUS_FIRST_CHECKIN : 0) +
    (c.first_day_active ? BONUS_FIRST_DAY : 0)
  );
}

export interface CheckInRequest {
  challenge_id: number;
  position: { lat: number; lon: number; accuracy_m: number };
  client_ts: string;
  quiz_answer_index?: number;
}

export interface BadgeInfo {
  id: number;
  title: string;
  icon: string;
  description: string;
  awarded_at?: string;
}

export interface BonusInfo {
  points: number;
  reason: string;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  points_awarded: number;
  bonuses: BonusInfo[];
  badges_unlocked: BadgeInfo[];
  distance_m: number | null;
  is_flagged: boolean;
  attempts_left?: number | null;
  referral_milestone_triggered?: boolean;
  photo_required?: boolean;
}

export interface UserRankEntry {
  rank: number;
  user_id: number;
  display_name: string;
  points: number;
  checkin_count: number;
}

export interface UserProgress {
  user_id: number;
  display_name: string;
  points: number;
  checkin_count: number;
  badges: BadgeInfo[];
  referral_code?: string | null;
  referrals_registered?: number;
  referrals_milestone?: number;
}

export interface AuthState {
  token: string;
  user_id: number;
  display_name: string;
  role: string;
}
