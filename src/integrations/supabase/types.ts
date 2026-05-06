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
      activity_log: {
        Row: {
          action: string
          actor_name: string
          created_at: string
          details: Json | null
          entity: string
          id: string
          plan_id: string
          task_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string
          created_at?: string
          details?: Json | null
          entity?: string
          id?: string
          plan_id: string
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string
          created_at?: string
          details?: Json | null
          entity?: string
          id?: string
          plan_id?: string
          task_id?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          business_name: string | null
          source: string
          stage: string
          assigned_to: string | null
          plan_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
          initial_revenue: string | null
          industry: string | null
          business_goals: string | null
          client_status: string | null
          client_since: string | null
          service_type: string | null
          id_number: string | null
          website: string | null
          employees_count: number | null
          contract_signed_date: string | null
          contract_end_date: string | null
          monthly_fee: string | null
          monthly_ad_budget: string | null
          business_type: string | null
          tax_id: string | null
          city: string | null
          meta_lead_id: string | null
          form_name: string | null
          ad_name: string | null
          campaign_name: string | null
          instagram_handle: string | null
          facebook_url: string | null
          tiktok_handle: string | null
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          business_name?: string | null
          source?: string
          stage?: string
          assigned_to?: string | null
          plan_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          initial_revenue?: string | null
          industry?: string | null
          business_goals?: string | null
          client_status?: string | null
          client_since?: string | null
          service_type?: string | null
          id_number?: string | null
          website?: string | null
          employees_count?: number | null
          contract_signed_date?: string | null
          contract_end_date?: string | null
          monthly_fee?: string | null
          monthly_ad_budget?: string | null
          business_type?: string | null
          tax_id?: string | null
          city?: string | null
          instagram_handle?: string | null
          facebook_url?: string | null
          tiktok_handle?: string | null
          meta_lead_id?: string | null
          form_name?: string | null
          ad_name?: string | null
          campaign_name?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          business_name?: string | null
          source?: string
          stage?: string
          assigned_to?: string | null
          plan_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          initial_revenue?: string | null
          industry?: string | null
          business_goals?: string | null
          client_status?: string | null
          client_since?: string | null
          service_type?: string | null
          id_number?: string | null
          website?: string | null
          employees_count?: number | null
          contract_signed_date?: string | null
          contract_end_date?: string | null
          monthly_fee?: string | null
          monthly_ad_budget?: string | null
          business_type?: string | null
          tax_id?: string | null
          city?: string | null
          instagram_handle?: string | null
          facebook_url?: string | null
          tiktok_handle?: string | null
          meta_lead_id?: string | null
          form_name?: string | null
          ad_name?: string | null
          campaign_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          id: string
          contact_id: string | null
          plan_id: string | null
          type: string
          title: string
          meeting_date: string
          meeting_time: string | null
          duration_minutes: number | null
          status: string
          attendees: string[]
          location: string | null
          notes: string | null
          action_items: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id?: string | null
          plan_id?: string | null
          type?: string
          title: string
          meeting_date: string
          meeting_time?: string | null
          duration_minutes?: number | null
          status?: string
          attendees?: string[]
          location?: string | null
          notes?: string | null
          action_items?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string | null
          plan_id?: string | null
          type?: string
          title?: string
          meeting_date?: string
          meeting_time?: string | null
          duration_minutes?: number | null
          status?: string
          attendees?: string[]
          location?: string | null
          notes?: string | null
          action_items?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          id: string
          contact_id: string | null
          plan_id: string | null
          title: string
          content_type: string
          status: string
          shoot_date: string | null
          due_date: string | null
          delivery_date: string | null
          assigned_editor: string | null
          notes: string | null
          drive_link: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id?: string | null
          plan_id?: string | null
          title: string
          content_type?: string
          status?: string
          shoot_date?: string | null
          due_date?: string | null
          delivery_date?: string | null
          assigned_editor?: string | null
          notes?: string | null
          drive_link?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string | null
          plan_id?: string | null
          title?: string
          content_type?: string
          status?: string
          shoot_date?: string | null
          due_date?: string | null
          delivery_date?: string | null
          assigned_editor?: string | null
          notes?: string | null
          drive_link?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          admin_password_hash: string | null
          created_at: string
          id: number
          updated_at: string
          lead_stages: Json | null
        }
        Insert: {
          admin_password_hash?: string | null
          created_at?: string
          id?: number
          updated_at?: string
          lead_stages?: Json | null
        }
        Update: {
          admin_password_hash?: string | null
          created_at?: string
          id?: number
          updated_at?: string
          lead_stages?: Json | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_tasks: {
        Row: {
          assignee_id: string | null
          client_task_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          plan_id: string | null
          position: number
          priority: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          plan_id?: string | null
          position?: number
          priority?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          plan_id?: string | null
          position?: number
          priority?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_client_task_id_fkey"
            columns: ["client_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "team_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_done: boolean
          label: string
          position: number
          status_key: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_done?: boolean
          label: string
          position?: number
          status_key: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_done?: boolean
          label?: string
          position?: number
          status_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          accent_color: string | null
          archived: boolean
          created_at: string
          id: string
          name: string
          share_token: string
          slug: string
          status_colors: Json
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          share_token?: string
          slug: string
          status_colors?: Json
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          share_token?: string
          slug?: string
          status_colors?: Json
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_steps: {
        Row: {
          content: string
          created_at: string
          done: boolean
          id: string
          position: number
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          deadline: string | null
          department: string | null
          id: string
          note: string | null
          plan_id: string
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          department?: string | null
          id?: string
          note?: string | null
          plan_id: string
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          department?: string | null
          id?: string
          note?: string | null
          plan_id?: string
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      team_goals: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          parent_id: string | null
          period_end: string
          period_start: string
          period_type: string
          position: number
          progress: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          period_end: string
          period_start: string
          period_type: string
          position?: number
          progress?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          period_end?: string
          period_start?: string
          period_type?: string
          position?: number
          progress?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_goals_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "team_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      shoot_days: {
        Row: {
          id: string
          contact_id: string | null
          shoot_date: string | null
          creative_brief: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id?: string | null
          shoot_date?: string | null
          creative_brief?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string | null
          shoot_date?: string | null
          creative_brief?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_days_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_videos: {
        Row: {
          id: string
          shoot_day_id: string
          title: string
          content_type: string
          edit_status: string
          assigned_editor: string | null
          drive_link: string | null
          notes: string | null
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          shoot_day_id: string
          title?: string
          content_type?: string
          edit_status?: string
          assigned_editor?: string | null
          drive_link?: string | null
          notes?: string | null
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          shoot_day_id?: string
          title?: string
          content_type?: string
          edit_status?: string
          assigned_editor?: string | null
          drive_link?: string | null
          notes?: string | null
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_videos_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      app_settings_public: {
        Row: {
          admin_password_set: boolean | null
          id: number | null
          updated_at: string | null
        }
        Insert: {
          admin_password_set?: never
          id?: number | null
          updated_at?: string | null
        }
        Update: {
          admin_password_set?: never
          id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
