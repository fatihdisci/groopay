export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  locale: string;
  preferred_currency: string | null;
  user_pro: boolean;
  user_pro_purchased_at: string | null;
}

export interface AuthState {
  user: Profile | null;
  isAnonymous: boolean;
  isLoading: boolean;
}

export type OAuthProvider = 'google' | 'apple';

/** Result of guest → OAuth upgrade attempt in the purchase flow. */
export interface GuestUpgradeResult {
  status: 'linked' | 'cancelled' | 'already_exists' | 'error';
  provider: OAuthProvider;
  /** Supabase auth user id after a successful link — RevenueCat must be
   *  logged in as this id before the purchase starts. */
  userId?: string;
  /** iOS Apple: preserved credential so the paywall can retry sign-in without re-prompting. */
  appleRetryToken?: string;
  appleRetryNonce?: string;
  errorMessage?: string;
}
