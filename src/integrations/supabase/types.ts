export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      exercises: {
        Row: {
          category: string
          created_at: string
          difficulty: number
          equipment: string
          id: string
          instructions: string
          is_compound: boolean
          name: string
          primary_muscles: string[]
          pro_tip: string
          secondary_muscles: string[]
          slug: string
          stretch_note: string
          warmup_note: string
          youtube_query: string
        }
        Insert: {
          category: string
          created_at?: string
          difficulty?: number
          equipment: string
          id?: string
          instructions?: string
          is_compound?: boolean
          name: string
          primary_muscles?: string[]
          pro_tip?: string
          secondary_muscles?: string[]
          slug: string
          stretch_note?: string
          warmup_note?: string
          youtube_query?: string
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: number
          equipment?: string
          id?: string
          instructions?: string
          is_compound?: boolean
          name?: string
          primary_muscles?: string[]
          pro_tip?: string
          secondary_muscles?: string[]
          slug?: string
          stretch_note?: string
          warmup_note?: string
          youtube_query?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          kind: string
          metadata: Json
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind: string
          metadata?: Json
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_program_id: string | null
          age: number
          avatar_url: string | null
          bio: string | null
          checkin_streak: number
          city: string | null
          country: string | null
          created_at: string
          days_per_week: number
          diet_streak: number
          dislikes: string | null
          display_name: string | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          experience: Database["public"]["Enums"]["experience_level"]
          gender: Database["public"]["Enums"]["gender_type"]
          goal: Database["public"]["Enums"]["training_goal"]
          grit_points: number
          height_cm: number
          id: string
          level: string
          location_updated_at: string | null
          onboarded: boolean
          pro_until: string | null
          public_stats: Json
          referral_code: string | null
          referred_by: string | null
          region: string | null
          updated_at: string
          username: string | null
          weight_kg: number
          workout_streak: number
        }
        Insert: {
          active_program_id?: string | null
          age?: number
          avatar_url?: string | null
          bio?: string | null
          checkin_streak?: number
          city?: string | null
          country?: string | null
          created_at?: string
          days_per_week?: number
          diet_streak?: number
          dislikes?: string | null
          display_name?: string | null
          equipment?: Database["public"]["Enums"]["equipment_type"]
          experience?: Database["public"]["Enums"]["experience_level"]
          gender?: Database["public"]["Enums"]["gender_type"]
          goal?: Database["public"]["Enums"]["training_goal"]
          grit_points?: number
          height_cm?: number
          id: string
          level?: string
          location_updated_at?: string | null
          onboarded?: boolean
          pro_until?: string | null
          public_stats?: Json
          referral_code?: string | null
          referred_by?: string | null
          region?: string | null
          updated_at?: string
          username?: string | null
          weight_kg?: number
          workout_streak?: number
        }
        Update: {
          active_program_id?: string | null
          age?: number
          avatar_url?: string | null
          bio?: string | null
          checkin_streak?: number
          city?: string | null
          country?: string | null
          created_at?: string
          days_per_week?: number
          diet_streak?: number
          dislikes?: string | null
          display_name?: string | null
          equipment?: Database["public"]["Enums"]["equipment_type"]
          experience?: Database["public"]["Enums"]["experience_level"]
          gender?: Database["public"]["Enums"]["gender_type"]
          goal?: Database["public"]["Enums"]["training_goal"]
          grit_points?: number
          height_cm?: number
          id?: string
          level?: string
          location_updated_at?: string | null
          onboarded?: boolean
          pro_until?: string | null
          public_stats?: Json
          referral_code?: string | null
          referred_by?: string | null
          region?: string | null
          updated_at?: string
          username?: string | null
          weight_kg?: number
          workout_streak?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_post_id: string | null
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reported_post_id_fkey"
            columns: ["reported_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_state: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          display_name: string | null
          grit_points: number | null
          id: string | null
          level: string | null
          public_stats: Json | null
          region: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          display_name?: string | null
          grit_points?: number | null
          id?: string | null
          level?: string | null
          public_stats?: Json | null
          region?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          display_name?: string | null
          grit_points?: number | null
          id?: string | null
          level?: string | null
          public_stats?: Json | null
          region?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      gen_ref_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "premium"
      equipment_type: "FULL_GYM" | "HOME_GYM" | "DUMBBELLS_ONLY" | "BODYWEIGHT"
      experience_level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
      gender_type: "MALE" | "FEMALE" | "OTHER"
      training_goal: "BULK" | "CUT" | "MAINTAIN" | "ATHLETIC"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "premium"],
      equipment_type: ["FULL_GYM", "HOME_GYM", "DUMBBELLS_ONLY", "BODYWEIGHT"],
      experience_level: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      gender_type: ["MALE", "FEMALE", "OTHER"],
      training_goal: ["BULK", "CUT", "MAINTAIN", "ATHLETIC"],
    },
  },
} as const
