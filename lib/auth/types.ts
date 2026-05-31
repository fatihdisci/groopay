export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  locale: string;
  user_pro: boolean;
  user_pro_purchased_at: string | null;
}

export interface AuthState {
  user: Profile | null;
  isLoading: boolean;
}
