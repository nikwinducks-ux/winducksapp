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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allocation_policies: {
        Row: {
          active: boolean
          created_at: string
          created_by_user_id: string | null
          fairness_json: Json
          id: string
          version_name: string
          weights_json: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by_user_id?: string | null
          fairness_json?: Json
          id?: string
          version_name: string
          weights_json?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by_user_id?: string | null
          fairness_json?: Json
          id?: string
          version_name?: string
          weights_json?: Json
        }
        Relationships: []
      }
      allocation_run_candidates: {
        Row: {
          allocation_run_id: string
          eligibility_status: string
          exclusion_reason: string | null
          factor_scores_json: Json
          fairness_adjustment: number
          final_score: number
          id: string
          rank: number
          sp_id: string
          weighted_score: number
        }
        Insert: {
          allocation_run_id: string
          eligibility_status?: string
          exclusion_reason?: string | null
          factor_scores_json?: Json
          fairness_adjustment?: number
          final_score?: number
          id?: string
          rank?: number
          sp_id: string
          weighted_score?: number
        }
        Update: {
          allocation_run_id?: string
          eligibility_status?: string
          exclusion_reason?: string | null
          factor_scores_json?: Json
          fairness_adjustment?: number
          final_score?: number
          id?: string
          rank?: number
          sp_id?: string
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocation_run_candidates_allocation_run_id_fkey"
            columns: ["allocation_run_id"]
            isOneToOne: false
            referencedRelation: "allocation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_run_candidates_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_runs: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          job_id: string
          label: string | null
          policy_id: string
          selected_sp_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          job_id: string
          label?: string | null
          policy_id: string
          selected_sp_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          job_id?: string
          label?: string | null
          policy_id?: string
          selected_sp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_runs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "allocation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_runs_selected_sp_id_fkey"
            columns: ["selected_sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_city: string
          address_country: string
          address_lat: number | null
          address_lng: number | null
          address_postal: string
          address_region: string
          address_street: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string
          phone: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          address_city?: string
          address_country?: string
          address_lat?: number | null
          address_lng?: number | null
          address_postal?: string
          address_region?: string
          address_street?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          notes?: string
          phone?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address_city?: string
          address_country?: string
          address_lat?: number | null
          address_lng?: number | null
          address_postal?: string
          address_region?: string
          address_street?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      job_assignments: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          assignment_type: string
          id: string
          job_id: string
          notes: string | null
          sp_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          assignment_type?: string
          id?: string
          job_id: string
          notes?: string | null
          sp_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          assignment_type?: string
          id?: string
          job_id?: string
          notes?: string | null
          sp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_events: {
        Row: {
          changed_at: string
          changed_by_sp_id: string | null
          changed_by_user_id: string | null
          id: string
          job_id: string
          new_status: string
          note: string | null
          old_status: string
        }
        Insert: {
          changed_at?: string
          changed_by_sp_id?: string | null
          changed_by_user_id?: string | null
          id?: string
          job_id: string
          new_status: string
          note?: string | null
          old_status: string
        }
        Update: {
          changed_at?: string
          changed_by_sp_id?: string | null
          changed_by_user_id?: string | null
          id?: string
          job_id?: string
          new_status?: string
          note?: string | null
          old_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_sp_id: string | null
          created_at: string
          customer_id: string | null
          estimated_duration: string
          id: string
          job_address_city: string
          job_address_country: string
          job_address_postal: string
          job_address_region: string
          job_address_street: string
          job_lat: number | null
          job_lng: number | null
          job_number: string
          notes: string
          payout: number
          scheduled_date: string | null
          scheduled_time: string
          scores: Json | null
          service_category: string
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_sp_id?: string | null
          created_at?: string
          customer_id?: string | null
          estimated_duration?: string
          id?: string
          job_address_city?: string
          job_address_country?: string
          job_address_postal?: string
          job_address_region?: string
          job_address_street?: string
          job_lat?: number | null
          job_lng?: number | null
          job_number?: string
          notes?: string
          payout?: number
          scheduled_date?: string | null
          scheduled_time?: string
          scores?: Json | null
          service_category?: string
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_sp_id?: string | null
          created_at?: string
          customer_id?: string | null
          estimated_duration?: string
          id?: string
          job_address_city?: string
          job_address_country?: string
          job_address_postal?: string
          job_address_region?: string
          job_address_street?: string
          job_lat?: number | null
          job_lng?: number | null
          job_number?: string
          notes?: string
          payout?: number
          scheduled_date?: string | null
          scheduled_time?: string
          scores?: Json | null
          service_category?: string
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_sp_id_fkey"
            columns: ["assigned_sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_providers: {
        Row: {
          acceptance_rate: number
          auto_accept: boolean
          avg_response_time: string
          base_address_city: string
          base_address_country: string
          base_address_postal: string
          base_address_region: string
          base_address_street: string
          base_lat: number | null
          base_lng: number | null
          cancellation_rate: number
          categories: string[]
          certifications: string[]
          completion_rate: number
          compliance_status: string
          created_at: string
          email: string
          fairness_share: number
          fairness_status: string
          id: string
          insurance_expiry: string | null
          joined_date: string | null
          max_jobs_per_day: number
          name: string
          notes: string
          on_time_rate: number
          phone: string
          rating: number
          reliability_score: number
          service_radius_km: number
          status: string
          total_jobs_completed: number
          updated_at: string
        }
        Insert: {
          acceptance_rate?: number
          auto_accept?: boolean
          avg_response_time?: string
          base_address_city?: string
          base_address_country?: string
          base_address_postal?: string
          base_address_region?: string
          base_address_street?: string
          base_lat?: number | null
          base_lng?: number | null
          cancellation_rate?: number
          categories?: string[]
          certifications?: string[]
          completion_rate?: number
          compliance_status?: string
          created_at?: string
          email?: string
          fairness_share?: number
          fairness_status?: string
          id?: string
          insurance_expiry?: string | null
          joined_date?: string | null
          max_jobs_per_day?: number
          name: string
          notes?: string
          on_time_rate?: number
          phone?: string
          rating?: number
          reliability_score?: number
          service_radius_km?: number
          status?: string
          total_jobs_completed?: number
          updated_at?: string
        }
        Update: {
          acceptance_rate?: number
          auto_accept?: boolean
          avg_response_time?: string
          base_address_city?: string
          base_address_country?: string
          base_address_postal?: string
          base_address_region?: string
          base_address_street?: string
          base_lat?: number | null
          base_lng?: number | null
          cancellation_rate?: number
          categories?: string[]
          certifications?: string[]
          completion_rate?: number
          compliance_status?: string
          created_at?: string
          email?: string
          fairness_share?: number
          fairness_status?: string
          id?: string
          insurance_expiry?: string | null
          joined_date?: string | null
          max_jobs_per_day?: number
          name?: string
          notes?: string
          on_time_rate?: number
          phone?: string
          rating?: number
          reliability_score?: number
          service_radius_km?: number
          status?: string
          total_jobs_completed?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          sp_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          sp_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sp_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_sp_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sp"
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
      app_role: ["admin", "sp"],
    },
  },
} as const
