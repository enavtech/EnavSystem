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
      activities: {
        Row: {
          contact_id: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          status: string | null
          type: string
        }
        Insert: {
          contact_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          type: string
        }
        Update: {
          contact_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      app_settings: {
        Row: {
          admin_password_hash: string | null
          created_at: string
          id: number
          lead_stages: Json | null
          updated_at: string
        }
        Insert: {
          admin_password_hash?: string | null
          created_at?: string
          id?: number
          lead_stages?: Json | null
          updated_at?: string
        }
        Update: {
          admin_password_hash?: string | null
          created_at?: string
          id?: number
          lead_stages?: Json | null
          updated_at?: string
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
      contacts: {
        Row: {
          ad_name: string | null
          assigned_to: string | null
          business_goals: string | null
          business_name: string | null
          business_type: string | null
          campaign_name: string | null
          city: string | null
          client_since: string | null
          client_status: string | null
          contract_end_date: string | null
          contract_signed_date: string | null
          created_at: string
          email: string | null
          employees_count: number | null
          facebook_url: string | null
          form_name: string | null
          id: string
          id_number: string | null
          industry: string | null
          initial_revenue: string | null
          instagram_handle: string | null
          lead_date: string | null
          meta_lead_id: string | null
          monthly_ad_budget: string | null
          monthly_fee: string | null
          name: string
          notes: string | null
          phone: string | null
          plan_id: string | null
          service_type: string | null
          source: string
          stage: string
          tax_id: string | null
          tiktok_handle: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          ad_name?: string | null
          assigned_to?: string | null
          business_goals?: string | null
          business_name?: string | null
          business_type?: string | null
          campaign_name?: string | null
          city?: string | null
          client_since?: string | null
          client_status?: string | null
          contract_end_date?: string | null
          contract_signed_date?: string | null
          created_at?: string
          email?: string | null
          employees_count?: number | null
          facebook_url?: string | null
          form_name?: string | null
          id?: string
          id_number?: string | null
          industry?: string | null
          initial_revenue?: string | null
          instagram_handle?: string | null
          lead_date?: string | null
          meta_lead_id?: string | null
          monthly_ad_budget?: string | null
          monthly_fee?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          service_type?: string | null
          source?: string
          stage?: string
          tax_id?: string | null
          tiktok_handle?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          ad_name?: string | null
          assigned_to?: string | null
          business_goals?: string | null
          business_name?: string | null
          business_type?: string | null
          campaign_name?: string | null
          city?: string | null
          client_since?: string | null
          client_status?: string | null
          contract_end_date?: string | null
          contract_signed_date?: string | null
          created_at?: string
          email?: string | null
          employees_count?: number | null
          facebook_url?: string | null
          form_name?: string | null
          id?: string
          id_number?: string | null
          industry?: string | null
          initial_revenue?: string | null
          instagram_handle?: string | null
          lead_date?: string | null
          meta_lead_id?: string | null
          monthly_ad_budget?: string | null
          monthly_fee?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          service_type?: string | null
          source?: string
          stage?: string
          tax_id?: string | null
          tiktok_handle?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      content_items: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
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
      meetings: {
        Row: {
          action_items: Json
          attendees: string[]
          contact_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_date: string
          meeting_time: string | null
          notes: string | null
          plan_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          action_items?: Json
          attendees?: string[]
          contact_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_time?: string | null
          notes?: string | null
          plan_id?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          action_items?: Json
          attendees?: string[]
          contact_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_time?: string | null
          notes?: string | null
          plan_id?: string | null
          status?: string
          title?: string
          type?: string
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
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          old_status_key: string | null
          status_key: string | null
          task_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          old_status_key?: string | null
          status_key?: string | null
          task_id?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          old_status_key?: string | null
          status_key?: string | null
          task_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          accent_color: string | null
          archived: boolean
          created_at: string
          id: string
          is_template: boolean
          logo_url: string | null
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
          is_template?: boolean
          logo_url?: string | null
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
          is_template?: boolean
          logo_url?: string | null
          name?: string
          share_token?: string
          slug?: string
          status_colors?: Json
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shoot_days: {
        Row: {
          contact_id: string | null
          created_at: string
          creative_brief: string | null
          id: string
          shoot_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          creative_brief?: string | null
          id?: string
          shoot_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          creative_brief?: string | null
          id?: string
          shoot_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_days_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_videos: {
        Row: {
          assigned_editor: string | null
          content_type: string
          created_at: string
          drive_link: string | null
          edit_status: string
          id: string
          notes: string | null
          position: number
          shoot_day_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_editor?: string | null
          content_type?: string
          created_at?: string
          drive_link?: string | null
          edit_status?: string
          id?: string
          notes?: string | null
          position?: number
          shoot_day_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          assigned_editor?: string | null
          content_type?: string
          created_at?: string
          drive_link?: string | null
          edit_status?: string
          id?: string
          notes?: string | null
          position?: number
          shoot_day_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_videos_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
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
          period_type?: string
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
        Relationships: []
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
