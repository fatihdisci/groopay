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
  isLoading: boolean;
}

export type OAuthProvider = 'google' | 'apple';
