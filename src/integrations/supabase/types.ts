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
      admin_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_email: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_email?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
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
          finalized_at: string | null
          id: string
          job_id: string
          label: string | null
          policy_id: string
          selected_sp_id: string | null
          strategy: string
          top_n: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          finalized_at?: string | null
          id?: string
          job_id: string
          label?: string | null
          policy_id: string
          selected_sp_id?: string | null
          strategy?: string
          top_n?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          finalized_at?: string | null
          id?: string
          job_id?: string
          label?: string | null
          policy_id?: string
          selected_sp_id?: string | null
          strategy?: string
          top_n?: number
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
      app_settings: {
        Row: {
          company_address: string
          company_email: string
          company_logo_url: string
          company_name: string
          company_phone: string
          default_marketing_pct: number
          default_payment_terms: string
          default_payout_fee_percent: number
          default_platform_fee_pct: number
          default_sp_portion_pct: number
          default_subscription_fee_monthly: number
          default_tax_pct: number
          id: number
          next_estimate_number: number
          next_invoice_number: number
          payment_instructions: string
          updated_at: string
        }
        Insert: {
          company_address?: string
          company_email?: string
          company_logo_url?: string
          company_name?: string
          company_phone?: string
          default_marketing_pct?: number
          default_payment_terms?: string
          default_payout_fee_percent?: number
          default_platform_fee_pct?: number
          default_sp_portion_pct?: number
          default_subscription_fee_monthly?: number
          default_tax_pct?: number
          id?: number
          next_estimate_number?: number
          next_invoice_number?: number
          payment_instructions?: string
          updated_at?: string
        }
        Update: {
          company_address?: string
          company_email?: string
          company_logo_url?: string
          company_name?: string
          company_phone?: string
          default_marketing_pct?: number
          default_payment_terms?: string
          default_payout_fee_percent?: number
          default_platform_fee_pct?: number
          default_sp_portion_pct?: number
          default_subscription_fee_monthly?: number
          default_tax_pct?: number
          id?: number
          next_estimate_number?: number
          next_invoice_number?: number
          payment_instructions?: string
          updated_at?: string
        }
        Relationships: []
      }
      availability_events: {
        Row: {
          changed_at: string
          changed_by_user_id: string | null
          changes_json: Json
          id: string
          note: string | null
          sp_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id?: string | null
          changes_json?: Json
          id?: string
          note?: string | null
          sp_id: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string | null
          changes_json?: Json
          id?: string
          note?: string | null
          sp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_events_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activity_log: {
        Row: {
          actor_email: string
          actor_role: string
          actor_user_id: string | null
          created_at: string
          customer_id: string
          details: Json
          event_type: string
          id: string
          job_id: string | null
          summary: string
        }
        Insert: {
          actor_email?: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          customer_id: string
          details?: Json
          event_type: string
          id?: string
          job_id?: string | null
          summary: string
        }
        Update: {
          actor_email?: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          customer_id?: string
          details?: Json
          event_type?: string
          id?: string
          job_id?: string | null
          summary?: string
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          display_order: number
          email: string
          id: string
          is_primary: boolean
          name: string
          phone: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          display_order?: number
          email?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          display_order?: number
          email?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoice_line_items: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          amount_paid: number
          archived_at: string | null
          assigned_sp_id: string | null
          balance_due: number
          billing_address_city: string
          billing_address_country: string
          billing_address_postal: string
          billing_address_region: string
          billing_address_street: string
          billing_same_as_service: boolean
          created_at: string
          created_by_user_id: string | null
          customer_facing_notes: string
          customer_id: string | null
          deposit_applied: number
          discount_total: number
          due_date: string | null
          id: string
          internal_notes: string
          invoice_date: string
          invoice_number: string
          job_id: string | null
          notes: string
          paid_at: string | null
          paid_by_user_id: string | null
          parent_invoice_id: string | null
          payment_method: string
          payment_reference: string
          payment_terms: string
          payment_terms_days: number
          pdf_storage_path: string
          products_subtotal: number
          selected_package_id: string | null
          sent_at: string | null
          sent_by_user_id: string | null
          service_address_city: string
          service_address_country: string
          service_address_postal: string
          service_address_region: string
          service_address_street: string
          services_subtotal: number
          share_token: string
          snapshot_json: Json | null
          source_estimate_id: string | null
          source_estimate_package_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_pct: number
          terms: string
          total: number
          updated_at: string
          viewed_at: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paid?: number
          archived_at?: string | null
          assigned_sp_id?: string | null
          balance_due?: number
          billing_address_city?: string
          billing_address_country?: string
          billing_address_postal?: string
          billing_address_region?: string
          billing_address_street?: string
          billing_same_as_service?: boolean
          created_at?: string
          created_by_user_id?: string | null
          customer_facing_notes?: string
          customer_id?: string | null
          deposit_applied?: number
          discount_total?: number
          due_date?: string | null
          id?: string
          internal_notes?: string
          invoice_date?: string
          invoice_number: string
          job_id?: string | null
          notes?: string
          paid_at?: string | null
          paid_by_user_id?: string | null
          parent_invoice_id?: string | null
          payment_method?: string
          payment_reference?: string
          payment_terms?: string
          payment_terms_days?: number
          pdf_storage_path?: string
          products_subtotal?: number
          selected_package_id?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          service_address_city?: string
          service_address_country?: string
          service_address_postal?: string
          service_address_region?: string
          service_address_street?: string
          services_subtotal?: number
          share_token?: string
          snapshot_json?: Json | null
          source_estimate_id?: string | null
          source_estimate_package_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_pct?: number
          terms?: string
          total?: number
          updated_at?: string
          viewed_at?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paid?: number
          archived_at?: string | null
          assigned_sp_id?: string | null
          balance_due?: number
          billing_address_city?: string
          billing_address_country?: string
          billing_address_postal?: string
          billing_address_region?: string
          billing_address_street?: string
          billing_same_as_service?: boolean
          created_at?: string
          created_by_user_id?: string | null
          customer_facing_notes?: string
          customer_id?: string | null
          deposit_applied?: number
          discount_total?: number
          due_date?: string | null
          id?: string
          internal_notes?: string
          invoice_date?: string
          invoice_number?: string
          job_id?: string | null
          notes?: string
          paid_at?: string | null
          paid_by_user_id?: string | null
          parent_invoice_id?: string | null
          payment_method?: string
          payment_reference?: string
          payment_terms?: string
          payment_terms_days?: number
          pdf_storage_path?: string
          products_subtotal?: number
          selected_package_id?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          service_address_city?: string
          service_address_country?: string
          service_address_postal?: string
          service_address_region?: string
          service_address_street?: string
          services_subtotal?: number
          share_token?: string
          snapshot_json?: Json | null
          source_estimate_id?: string | null
          source_estimate_package_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_pct?: number
          terms?: string
          total?: number
          updated_at?: string
          viewed_at?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_properties: {
        Row: {
          address_city: string
          address_country: string
          address_lat: number | null
          address_lng: number | null
          address_postal: string
          address_region: string
          address_street: string
          created_at: string
          customer_id: string
          display_order: number
          id: string
          is_primary: boolean
          label: string
          notes: string
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
          customer_id: string
          display_order?: number
          id?: string
          is_primary?: boolean
          label?: string
          notes?: string
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
          customer_id?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          label?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_properties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          company_name: string
          created_at: string
          display_as: string
          email: string
          first_name: string
          id: string
          last_name: string
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
          company_name?: string
          created_at?: string
          display_as?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
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
          company_name?: string
          created_at?: string
          display_as?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          name?: string
          notes?: string
          phone?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          applies_to: string
          code: string
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          max_uses: number | null
          min_subtotal: number
          notes: string
          updated_at: string
          uses_count: number
          value: number
        }
        Insert: {
          active?: boolean
          applies_to?: string
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          max_uses?: number | null
          min_subtotal?: number
          notes?: string
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Update: {
          active?: boolean
          applies_to?: string
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          max_uses?: number | null
          min_subtotal?: number
          notes?: string
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      estimate_applied_codes: {
        Row: {
          amount_applied: number
          applied_at: string
          applies_to: string
          code_snapshot: string
          discount_code_id: string | null
          estimate_id: string
          id: string
          kind: string
          value: number
        }
        Insert: {
          amount_applied?: number
          applied_at?: string
          applies_to?: string
          code_snapshot?: string
          discount_code_id?: string | null
          estimate_id: string
          id?: string
          kind?: string
          value?: number
        }
        Update: {
          amount_applied?: number
          applied_at?: string
          applies_to?: string
          code_snapshot?: string
          discount_code_id?: string | null
          estimate_id?: string
          id?: string
          kind?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_applied_codes_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_applied_codes_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_discounts: {
        Row: {
          created_at: string
          estimate_id: string
          id: string
          kind: string
          package_id: string | null
          reason: string
          scope: string
          value: number
        }
        Insert: {
          created_at?: string
          estimate_id: string
          id?: string
          kind?: string
          package_id?: string | null
          reason?: string
          scope?: string
          value?: number
        }
        Update: {
          created_at?: string
          estimate_id?: string
          id?: string
          kind?: string
          package_id?: string | null
          reason?: string
          scope?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_discounts_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_discounts_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "estimate_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          customer_ip: string
          details: Json
          estimate_id: string
          event_type: string
          id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          customer_ip?: string
          details?: Json
          estimate_id: string
          event_type: string
          id?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          customer_ip?: string
          details?: Json
          estimate_id?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_events_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          catalog_ref_id: string | null
          created_at: string
          description: string
          discount_allowed: boolean
          display_order: number
          id: string
          image_url: string
          is_optional: boolean
          is_selected: boolean
          item_type: string
          name: string
          package_id: string
          quantity: number
          taxable: boolean
          unit_price: number
        }
        Insert: {
          catalog_ref_id?: string | null
          created_at?: string
          description?: string
          discount_allowed?: boolean
          display_order?: number
          id?: string
          image_url?: string
          is_optional?: boolean
          is_selected?: boolean
          item_type?: string
          name?: string
          package_id: string
          quantity?: number
          taxable?: boolean
          unit_price?: number
        }
        Update: {
          catalog_ref_id?: string | null
          created_at?: string
          description?: string
          discount_allowed?: boolean
          display_order?: number
          id?: string
          image_url?: string
          is_optional?: boolean
          is_selected?: boolean
          item_type?: string
          name?: string
          package_id?: string
          quantity?: number
          taxable?: boolean
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "estimate_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_packages: {
        Row: {
          created_at: string
          description: string
          display_order: number
          estimate_id: string
          id: string
          is_recommended: boolean
          is_selected: boolean
          name: string
          package_discount_kind: string
          package_discount_reason: string
          package_discount_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          estimate_id: string
          id?: string
          is_recommended?: boolean
          is_selected?: boolean
          name?: string
          package_discount_kind?: string
          package_discount_reason?: string
          package_discount_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          estimate_id?: string
          id?: string
          is_recommended?: boolean
          is_selected?: boolean
          name?: string
          package_discount_kind?: string
          package_discount_reason?: string
          package_discount_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_packages_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accepted_at: string | null
          accepted_deposit: number | null
          accepted_package_id: string | null
          accepted_total: number | null
          assigned_sp_id: string | null
          converted_at: string | null
          converted_job_id: string | null
          created_at: string
          created_by_user_id: string | null
          customer_id: string | null
          customer_notes: string
          customer_property_id: string | null
          decline_reason: string
          declined_at: string | null
          deposit_kind: string
          deposit_value: number
          estimate_date: string
          estimate_number: string
          expires_at: string | null
          id: string
          internal_notes: string
          job_id: string | null
          share_token: string
          snapshot_json: Json | null
          status: string
          tax_pct: number
          terms: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_deposit?: number | null
          accepted_package_id?: string | null
          accepted_total?: number | null
          assigned_sp_id?: string | null
          converted_at?: string | null
          converted_job_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string | null
          customer_notes?: string
          customer_property_id?: string | null
          decline_reason?: string
          declined_at?: string | null
          deposit_kind?: string
          deposit_value?: number
          estimate_date?: string
          estimate_number: string
          expires_at?: string | null
          id?: string
          internal_notes?: string
          job_id?: string | null
          share_token?: string
          snapshot_json?: Json | null
          status?: string
          tax_pct?: number
          terms?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_deposit?: number | null
          accepted_package_id?: string | null
          accepted_total?: number | null
          assigned_sp_id?: string | null
          converted_at?: string | null
          converted_job_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string | null
          customer_notes?: string
          customer_property_id?: string | null
          decline_reason?: string
          declined_at?: string | null
          deposit_kind?: string
          deposit_value?: number
          estimate_date?: string
          estimate_number?: string
          expires_at?: string | null
          id?: string
          internal_notes?: string
          job_id?: string | null
          share_token?: string
          snapshot_json?: Json | null
          status?: string
          tax_pct?: number
          terms?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      invoice_applied_codes: {
        Row: {
          amount_applied: number
          applied_at: string
          applies_to: string
          code_snapshot: string
          discount_code_id: string | null
          id: string
          invoice_id: string
          kind: string
          value: number
        }
        Insert: {
          amount_applied?: number
          applied_at?: string
          applies_to?: string
          code_snapshot?: string
          discount_code_id?: string | null
          id?: string
          invoice_id: string
          kind?: string
          value?: number
        }
        Update: {
          amount_applied?: number
          applied_at?: string
          applies_to?: string
          code_snapshot?: string
          discount_code_id?: string | null
          id?: string
          invoice_id?: string
          kind?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_applied_codes_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_applied_codes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_discounts: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          kind: string
          line_item_id: string | null
          package_id: string | null
          reason: string
          scope: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          kind?: string
          line_item_id?: string | null
          package_id?: string | null
          reason?: string
          scope?: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          kind?: string
          line_item_id?: string | null
          package_id?: string | null
          reason?: string
          scope?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_discounts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_discounts_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_discounts_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "invoice_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          customer_ip: string
          details: Json
          event_type: string
          id: string
          invoice_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          customer_ip?: string
          details?: Json
          event_type: string
          id?: string
          invoice_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          customer_ip?: string
          details?: Json
          event_type?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          catalog_ref_id: string | null
          created_at: string
          description: string
          discount_allowed: boolean
          display_order: number
          id: string
          image_url: string
          is_optional: boolean
          is_selected: boolean
          item_type: string
          name: string
          package_id: string
          quantity: number
          taxable: boolean
          unit_price: number
        }
        Insert: {
          catalog_ref_id?: string | null
          created_at?: string
          description?: string
          discount_allowed?: boolean
          display_order?: number
          id?: string
          image_url?: string
          is_optional?: boolean
          is_selected?: boolean
          item_type?: string
          name?: string
          package_id: string
          quantity?: number
          taxable?: boolean
          unit_price?: number
        }
        Update: {
          catalog_ref_id?: string | null
          created_at?: string
          description?: string
          discount_allowed?: boolean
          display_order?: number
          id?: string
          image_url?: string
          is_optional?: boolean
          is_selected?: boolean
          item_type?: string
          name?: string
          package_id?: string
          quantity?: number
          taxable?: boolean
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "invoice_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_packages: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          invoice_id: string
          is_recommended: boolean
          is_selected: boolean
          name: string
          package_discount_kind: string
          package_discount_reason: string
          package_discount_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          invoice_id: string
          is_recommended?: boolean
          is_selected?: boolean
          name?: string
          package_discount_kind?: string
          package_discount_reason?: string
          package_discount_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          invoice_id?: string
          is_recommended?: boolean
          is_selected?: boolean
          name?: string
          package_discount_kind?: string
          package_discount_reason?: string
          package_discount_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_packages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string
          payment_date: string
          recorded_by_user_id: string | null
          reference: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string
          payment_date?: string
          recorded_by_user_id?: string | null
          reference?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string
          payment_date?: string
          recorded_by_user_id?: string | null
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
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
      job_crew_members: {
        Row: {
          added_at: string
          added_by_user_id: string | null
          id: string
          is_lead: boolean
          job_id: string
          sp_id: string
        }
        Insert: {
          added_at?: string
          added_by_user_id?: string | null
          id?: string
          is_lead?: boolean
          job_id: string
          sp_id: string
        }
        Update: {
          added_at?: string
          added_by_user_id?: string | null
          id?: string
          is_lead?: boolean
          job_id?: string
          sp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_crew_members_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_crew_members_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string
          created_at: string
          id: string
          job_id: string
          storage_path: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          caption?: string
          created_at?: string
          id?: string
          job_id: string
          storage_path: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          caption?: string
          created_at?: string
          id?: string
          job_id?: string
          storage_path?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_reviews: {
        Row: {
          comment: string | null
          communication_score: number | null
          created_at: string
          customer_id: string | null
          id: string
          job_id: string
          on_time_score: number | null
          overall_rating: number | null
          quality_score: number | null
          review_token: string
          sp_id: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          comment?: string | null
          communication_score?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          job_id: string
          on_time_score?: number | null
          overall_rating?: number | null
          quality_score?: number | null
          review_token: string
          sp_id: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          comment?: string | null
          communication_score?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          job_id?: string
          on_time_score?: number | null
          overall_rating?: number | null
          quality_score?: number | null
          review_token?: string
          sp_id?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_reviews_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_scheduled_visits: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          duration_min: number
          id: string
          job_id: string
          note: string
          sp_id: string
          start_time: string
          status: string
          updated_at: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          duration_min?: number
          id?: string
          job_id: string
          note?: string
          sp_id: string
          start_time?: string
          status?: string
          updated_at?: string
          visit_date: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          duration_min?: number
          id?: string
          job_id?: string
          note?: string
          sp_id?: string
          start_time?: string
          status?: string
          updated_at?: string
          visit_date?: string
        }
        Relationships: []
      }
      job_services: {
        Row: {
          created_at: string
          id: string
          job_id: string
          line_total: number
          notes: string | null
          quantity: number
          service_category: string
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          line_total?: number
          notes?: string | null
          quantity?: number
          service_category?: string
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          line_total?: number
          notes?: string | null
          quantity?: number
          service_category?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_services_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
      job_visits: {
        Row: {
          created_at: string
          duration_secs: number | null
          ended_at: string | null
          id: string
          job_id: string
          notes: string
          sp_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_secs?: number | null
          ended_at?: string | null
          id?: string
          job_id: string
          notes?: string
          sp_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_secs?: number | null
          ended_at?: string | null
          id?: string
          job_id?: string
          notes?: string
          sp_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          assigned_sp_id: string | null
          broadcast_note: string
          broadcast_radius_km: number
          completed_at: string | null
          created_at: string
          customer_id: string | null
          customer_property_id: string | null
          deposit_due: number
          deposit_received: number
          deposit_received_at: string | null
          deposit_received_by_user_id: string | null
          estimated_duration: string
          id: string
          is_broadcast: boolean
          job_address_city: string
          job_address_country: string
          job_address_postal: string
          job_address_region: string
          job_address_street: string
          job_lat: number | null
          job_lng: number | null
          job_number: string
          marketing_recipient: string
          marketing_recipient_name: string
          notes: string
          payout: number
          scheduled_date: string | null
          scheduled_time: string
          scores: Json | null
          service_category: string
          source_estimate_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_sp_id?: string | null
          broadcast_note?: string
          broadcast_radius_km?: number
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_property_id?: string | null
          deposit_due?: number
          deposit_received?: number
          deposit_received_at?: string | null
          deposit_received_by_user_id?: string | null
          estimated_duration?: string
          id?: string
          is_broadcast?: boolean
          job_address_city?: string
          job_address_country?: string
          job_address_postal?: string
          job_address_region?: string
          job_address_street?: string
          job_lat?: number | null
          job_lng?: number | null
          job_number?: string
          marketing_recipient?: string
          marketing_recipient_name?: string
          notes?: string
          payout?: number
          scheduled_date?: string | null
          scheduled_time?: string
          scores?: Json | null
          service_category?: string
          source_estimate_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_sp_id?: string | null
          broadcast_note?: string
          broadcast_radius_km?: number
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_property_id?: string | null
          deposit_due?: number
          deposit_received?: number
          deposit_received_at?: string | null
          deposit_received_by_user_id?: string | null
          estimated_duration?: string
          id?: string
          is_broadcast?: boolean
          job_address_city?: string
          job_address_country?: string
          job_address_postal?: string
          job_address_region?: string
          job_address_street?: string
          job_lat?: number | null
          job_lng?: number | null
          job_number?: string
          marketing_recipient?: string
          marketing_recipient_name?: string
          notes?: string
          payout?: number
          scheduled_date?: string | null
          scheduled_time?: string
          scores?: Json | null
          service_category?: string
          source_estimate_id?: string | null
          started_at?: string | null
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
          {
            foreignKeyName: "jobs_customer_property_id_fkey"
            columns: ["customer_property_id"]
            isOneToOne: false
            referencedRelation: "customer_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          acceptance_source: string
          allocation_run_id: string | null
          created_at: string
          created_by: string
          decline_reason: string | null
          expires_at: string
          id: string
          job_id: string
          offered_at: string
          responded_at: string | null
          sp_id: string
          status: string
        }
        Insert: {
          acceptance_source?: string
          allocation_run_id?: string | null
          created_at?: string
          created_by?: string
          decline_reason?: string | null
          expires_at?: string
          id?: string
          job_id: string
          offered_at?: string
          responded_at?: string | null
          sp_id: string
          status?: string
        }
        Update: {
          acceptance_source?: string
          allocation_run_id?: string | null
          created_at?: string
          created_by?: string
          decline_reason?: string | null
          expires_at?: string
          id?: string
          job_id?: string
          offered_at?: string
          responded_at?: string | null
          sp_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_allocation_run_id_fkey"
            columns: ["allocation_run_id"]
            isOneToOne: false
            referencedRelation: "allocation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          id: string
          image_url: string
          name: string
          sku: string
          taxable: boolean
          unit_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string
          name: string
          sku?: string
          taxable?: boolean
          unit_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string
          name?: string
          sku?: string
          taxable?: boolean
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          sp_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          sp_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          sp_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_category_line_items: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string
          display_order: number
          id: string
          price: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description: string
          display_order?: number
          id?: string
          price?: number
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          price?: number
          title?: string
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
          calendar_color: string | null
          cancellation_rate: number
          categories: string[]
          certifications: string[]
          comp_marketing_pct: number | null
          comp_platform_fee_pct: number | null
          comp_sp_portion_pct: number | null
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
          payout_fee_percent: number | null
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
          calendar_color?: string | null
          cancellation_rate?: number
          categories?: string[]
          certifications?: string[]
          comp_marketing_pct?: number | null
          comp_platform_fee_pct?: number | null
          comp_sp_portion_pct?: number | null
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
          payout_fee_percent?: number | null
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
          calendar_color?: string | null
          cancellation_rate?: number
          categories?: string[]
          certifications?: string[]
          comp_marketing_pct?: number | null
          comp_platform_fee_pct?: number | null
          comp_sp_portion_pct?: number | null
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
          payout_fee_percent?: number | null
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
      sp_availability: {
        Row: {
          blackout_dates: string[]
          id: string
          max_jobs_per_day: number
          schedule_json: Json
          sp_id: string
          travel_radius_km: number
          updated_at: string
        }
        Insert: {
          blackout_dates?: string[]
          id?: string
          max_jobs_per_day?: number
          schedule_json?: Json
          sp_id: string
          travel_radius_km?: number
          updated_at?: string
        }
        Update: {
          blackout_dates?: string[]
          id?: string
          max_jobs_per_day?: number
          schedule_json?: Json
          sp_id?: string
          travel_radius_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_availability_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: true
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_compensation_expenses: {
        Row: {
          active: boolean
          created_at: string
          expense_type: string
          id: string
          name: string
          sp_id: string
          updated_at: string
          value: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          expense_type?: string
          id?: string
          name?: string
          sp_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          expense_type?: string
          id?: string
          name?: string
          sp_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      sp_compliance_documents: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          document_type: string
          expires_on: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          name: string
          notes: string
          sp_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          document_type?: string
          expires_on?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          name: string
          notes?: string
          sp_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          document_type?: string
          expires_on?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          name?: string
          notes?: string
          sp_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sp_invoices: {
        Row: {
          created_at: string
          customer_id: string | null
          expense_deduction_amount: number
          fee_amount: number
          fee_percent: number
          gross_amount: number
          gross_sp_amount: number
          id: string
          job_id: string
          marketing_amount: number
          net_amount: number
          notes: string
          paid_at: string | null
          paid_by_user_id: string | null
          payment_method: string
          payment_reference: string
          platform_fee_amount: number
          sp_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          expense_deduction_amount?: number
          fee_amount?: number
          fee_percent?: number
          gross_amount?: number
          gross_sp_amount?: number
          id?: string
          job_id: string
          marketing_amount?: number
          net_amount?: number
          notes?: string
          paid_at?: string | null
          paid_by_user_id?: string | null
          payment_method?: string
          payment_reference?: string
          platform_fee_amount?: number
          sp_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          expense_deduction_amount?: number
          fee_amount?: number
          fee_percent?: number
          gross_amount?: number
          gross_sp_amount?: number
          id?: string
          job_id?: string
          marketing_amount?: number
          net_amount?: number
          notes?: string
          paid_at?: string | null
          paid_by_user_id?: string | null
          payment_method?: string
          payment_reference?: string
          platform_fee_amount?: number
          sp_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sp_unavailable_blocks: {
        Row: {
          block_date: string
          created_at: string
          created_by_user_id: string | null
          end_time: string
          id: string
          reason: string
          sp_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          block_date: string
          created_at?: string
          created_by_user_id?: string | null
          end_time: string
          id?: string
          reason?: string
          sp_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          block_date?: string
          created_at?: string
          created_by_user_id?: string | null
          end_time?: string
          id?: string
          reason?: string
          sp_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_unavailable_blocks_sp_id_fkey"
            columns: ["sp_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          disabled_at: string | null
          disabled_reason: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          sp_id: string | null
          user_id: string
        }
        Insert: {
          disabled_at?: string | null
          disabled_reason?: string | null
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          sp_id?: string | null
          user_id: string
        }
        Update: {
          disabled_at?: string | null
          disabled_reason?: string | null
          id?: string
          is_active?: boolean
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
      _actor_info: {
        Args: never
        Returns: {
          email: string
          role: string
          user_id: string
        }[]
      }
      _log_customer_activity: {
        Args: {
          _customer_id: string
          _details: Json
          _event_type: string
          _job_id: string
          _summary: string
        }
        Returns: undefined
      }
      accept_offer: { Args: { _offer_id: string }; Returns: Json }
      add_invoice_manual_discount: {
        Args: {
          _invoice_id: string
          _kind: string
          _line_item_id?: string
          _package_id?: string
          _reason?: string
          _scope: string
          _value: number
        }
        Returns: string
      }
      apply_discount_code: {
        Args: { _code: string; _estimate_id: string }
        Returns: Json
      }
      apply_invoice_discount_code: {
        Args: { _code: string; _invoice_id: string }
        Returns: Json
      }
      archive_invoice: { Args: { _invoice_id: string }; Returns: Json }
      convert_estimate_to_invoice: {
        Args: { _estimate_id: string }
        Returns: Json
      }
      convert_estimate_to_job: {
        Args: { _estimate_id: string; _existing_job_id?: string; _mode: string }
        Returns: Json
      }
      convert_job_to_invoice: { Args: { _job_id: string }; Returns: Json }
      create_estimate: {
        Args: {
          _assigned_sp_id?: string
          _customer_id?: string
          _customer_property_id?: string
          _job_id?: string
        }
        Returns: Json
      }
      create_invoice: {
        Args: {
          _assigned_sp_id?: string
          _customer_id?: string
          _job_id?: string
          _parent_invoice_id?: string
        }
        Returns: Json
      }
      customer_accept_estimate: {
        Args: {
          _accepted_deposit?: number
          _accepted_total: number
          _package_id: string
          _selected_item_ids: string[]
          _token: string
        }
        Returns: Json
      }
      customer_decline_estimate: {
        Args: { _reason?: string; _token: string }
        Returns: Json
      }
      decline_offer: {
        Args: { _offer_id: string; _reason?: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_job: { Args: { _job_id: string }; Returns: Json }
      duplicate_estimate: { Args: { _estimate_id: string }; Returns: string }
      duplicate_estimate_package: {
        Args: { _package_id: string }
        Returns: string
      }
      duplicate_invoice_package: {
        Args: { _package_id: string }
        Returns: string
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_customer_invoice_by_token: { Args: { _token: string }; Returns: Json }
      get_estimate_by_token: { Args: { _token: string }; Returns: Json }
      get_review_by_token: { Args: { _token: string }; Returns: Json }
      get_user_sp_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      hhmm_to_minutes: { Args: { _t: string }; Returns: number }
      is_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      mark_customer_invoice_sent: {
        Args: { _invoice_id: string; _pdf_path?: string }
        Returns: Json
      }
      mark_estimate_sent: { Args: { _estimate_id: string }; Returns: Json }
      mark_invoice_viewed_by_token: { Args: { _token: string }; Returns: Json }
      mark_job_ready_to_invoice: { Args: { _job_id: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_customer_invoice_number: { Args: never; Returns: string }
      parse_duration_minutes: { Args: { _d: string }; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_invoice_payment: {
        Args: {
          _amount: number
          _invoice_id: string
          _method?: string
          _notes?: string
          _payment_date?: string
          _reference?: string
        }
        Returns: Json
      }
      record_job_deposit: {
        Args: { _amount: number; _job_id: string; _method?: string }
        Returns: Json
      }
      remove_invoice_applied_code: {
        Args: { _applied_id: string }
        Returns: Json
      }
      sp_eligible_for_broadcast_job: {
        Args: { _job_id: string; _sp_id: string }
        Returns: boolean
      }
      sp_on_job_crew: {
        Args: { _job_id: string; _sp_id: string }
        Returns: boolean
      }
      sp_unavailable_overlaps: {
        Args: {
          _date: string
          _end_minutes: number
          _sp_id: string
          _start_minutes: number
        }
        Returns: boolean
      }
      stop_broadcast: { Args: { _job_id: string }; Returns: Json }
      submit_review: {
        Args: {
          _comment?: string
          _communication: number
          _on_time: number
          _quality: number
          _token: string
        }
        Returns: Json
      }
      unarchive_invoice: { Args: { _invoice_id: string }; Returns: Json }
      void_invoice: {
        Args: { _invoice_id: string; _reason?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "sp" | "owner"
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
      app_role: ["admin", "sp", "owner"],
    },
  },
} as const
