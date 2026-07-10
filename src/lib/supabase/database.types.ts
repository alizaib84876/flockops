// Auto-maintained type definitions for the FlockOps Supabase schema.
// Keep in sync with supabase/migrations/001_initial_schema.sql

export type UserRole = 'platform_admin' | 'owner' | 'manager' | 'worker'
export type BatchStatus = 'active' | 'harvested' | 'closed'
export type ExpenseCategory = 'chicks' | 'feed' | 'medicine' | 'labor' | 'utilities' | 'other'
export type VaccinationStatus = 'scheduled' | 'completed' | 'missed'
export type AlertType = 'mortality_spike' | 'vaccination_due' | 'low_feed_stock'
export type SubscriptionPlan = 'free' | 'basic' | 'pro'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'
export type FarmMemberRole = 'owner' | 'manager' | 'worker'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string
          role: UserRole
          farm_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email: string
          role?: UserRole
          farm_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string
          role?: UserRole
          farm_id?: string | null
          created_at?: string
        }
      }
      farms: {
        Row: {
          id: string
          name: string
          owner_user_id: string
          subscription_tier: SubscriptionPlan
          subscription_status: SubscriptionStatus
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_user_id: string
          subscription_tier?: SubscriptionPlan
          subscription_status?: SubscriptionStatus
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_user_id?: string
          subscription_tier?: SubscriptionPlan
          subscription_status?: SubscriptionStatus
          created_at?: string
        }
      }
      farm_members: {
        Row: {
          id: string
          farm_id: string
          user_id: string
          role: FarmMemberRole
          assigned_shed_ids: string[]
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          user_id: string
          role: FarmMemberRole
          assigned_shed_ids?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          user_id?: string
          role?: FarmMemberRole
          assigned_shed_ids?: string[]
          created_at?: string
        }
      }
      sheds: {
        Row: {
          id: string
          farm_id: string
          name: string
          capacity: number
          location: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          name: string
          capacity: number
          location?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          name?: string
          capacity?: number
          location?: string | null
          created_at?: string
        }
      }
      batches: {
        Row: {
          id: string
          shed_id: string
          breed: string
          placement_date: string
          starting_bird_count: number
          target_harvest_weight: number | null
          status: BatchStatus
          created_at: string
        }
        Insert: {
          id?: string
          shed_id: string
          breed: string
          placement_date: string
          starting_bird_count: number
          target_harvest_weight?: number | null
          status?: BatchStatus
          created_at?: string
        }
        Update: {
          id?: string
          shed_id?: string
          breed?: string
          placement_date?: string
          starting_bird_count?: number
          target_harvest_weight?: number | null
          status?: BatchStatus
          created_at?: string
        }
      }
      daily_logs: {
        Row: {
          id: string
          batch_id: string
          log_date: string
          mortality_count: number
          feed_given_kg: number
          feed_stock_remaining_kg: number
          water_consumption_l: number | null
          temperature_c: number | null
          humidity_pct: number | null
          notes: string | null
          logged_by_user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          log_date: string
          mortality_count: number
          feed_given_kg: number
          feed_stock_remaining_kg: number
          water_consumption_l?: number | null
          temperature_c?: number | null
          humidity_pct?: number | null
          notes?: string | null
          logged_by_user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          log_date?: string
          mortality_count?: number
          feed_given_kg?: number
          feed_stock_remaining_kg?: number
          water_consumption_l?: number | null
          temperature_c?: number | null
          humidity_pct?: number | null
          notes?: string | null
          logged_by_user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      daily_log_edits: {
        Row: {
          id: string
          daily_log_id: string
          edited_by_user_id: string
          field_name: string
          old_value: string | null
          new_value: string | null
          edited_at: string
        }
        Insert: {
          id?: string
          daily_log_id: string
          edited_by_user_id: string
          field_name: string
          old_value?: string | null
          new_value?: string | null
          edited_at?: string
        }
        Update: never
      }
      weight_samples: {
        Row: {
          id: string
          batch_id: string
          sample_date: string
          sample_size: number
          avg_weight_g: number
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          sample_date: string
          sample_size: number
          avg_weight_g: number
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          sample_date?: string
          sample_size?: number
          avg_weight_g?: number
          created_at?: string
        }
      }
      vaccinations: {
        Row: {
          id: string
          batch_id: string
          vaccine_name: string
          scheduled_date: string
          completed_date: string | null
          status: VaccinationStatus
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          vaccine_name: string
          scheduled_date: string
          completed_date?: string | null
          status?: VaccinationStatus
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          vaccine_name?: string
          scheduled_date?: string
          completed_date?: string | null
          status?: VaccinationStatus
          notes?: string | null
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          batch_id: string
          category: ExpenseCategory
          amount: number
          expense_date: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          category: ExpenseCategory
          amount: number
          expense_date: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          category?: ExpenseCategory
          amount?: number
          expense_date?: string
          notes?: string | null
          created_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          batch_id: string
          buyer_name: string
          sale_date: string
          total_weight_kg: number
          rate_per_kg: number
          condemned_birds_count: number
          total_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          buyer_name: string
          sale_date: string
          total_weight_kg: number
          rate_per_kg: number
          condemned_birds_count?: number
          total_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          buyer_name?: string
          sale_date?: string
          total_weight_kg?: number
          rate_per_kg?: number
          condemned_birds_count?: number
          total_amount?: number
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          farm_id: string
          plan: SubscriptionPlan
          status: SubscriptionStatus
          start_date: string
          next_billing_date: string | null
          payment_method: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          plan?: SubscriptionPlan
          status?: SubscriptionStatus
          start_date: string
          next_billing_date?: string | null
          payment_method?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          plan?: SubscriptionPlan
          status?: SubscriptionStatus
          start_date?: string
          next_billing_date?: string | null
          payment_method?: string | null
          created_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          farm_id: string
          shed_id: string | null
          batch_id: string | null
          type: AlertType
          message: string
          triggered_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          farm_id: string
          shed_id?: string | null
          batch_id?: string | null
          type: AlertType
          message: string
          triggered_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          farm_id?: string
          shed_id?: string | null
          batch_id?: string | null
          type?: AlertType
          message?: string
          triggered_at?: string
          resolved_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
