export type UserRole = 'admin' | 'developer' | 'support' | 'closer' | 'marketing'

export type TaskPriority = 'urgente' | 'alta' | 'media' | 'baja'
export type TaskStatus = 'todo' | 'in_progress' | 'code_review' | 'done'

export type TicketPriority = 'urgente' | 'alta' | 'media' | 'baja'
export type TicketStatus = 'Abierto' | 'En Revisión' | 'Resuelto'

export type LeadStage = 'prospecto' | 'demo' | 'negociacion' | 'cerrado'
export type LeadSource = 'referido' | 'cold_outreach' | 'sitio_web' | 'evento' | 'redes_sociales' | 'otro'
export type ActivityType = 'llamada' | 'reunion' | 'email' | 'nota'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          avatar_url: string | null
          role: UserRole
          allowed_modules: string[]
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      projects: {
        Row: {
          id: string
          name: string
          client: string
          color: string
          status: 'activo' | 'pausado' | 'completado'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      objectives: {
        Row: {
          id: string
          project_id: string
          name: string
          color: string
          start_date: string
          end_date: string
          status: 'pendiente' | 'en_progreso' | 'completado'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['objectives']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['objectives']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          objective_id: string
          title: string
          priority: TaskPriority
          status: TaskStatus
          assignee_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      tickets: {
        Row: {
          id: string
          client: string
          system: string
          subject: string
          description: string | null
          priority: TicketPriority
          status: TicketStatus
          assigned_to: string | null
          escalated_task_id: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>
      }
      ticket_comments: {
        Row: {
          id: string
          ticket_id: string
          author_id: string
          body: string
          is_internal: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ticket_comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ticket_comments']['Insert']>
      }
      ticket_activity: {
        Row: {
          id: string
          ticket_id: string
          author_id: string
          action: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ticket_activity']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ticket_activity']['Insert']>
      }
      leads: {
        Row: {
          id: string
          company: string
          contact_name: string
          contact_email: string | null
          contact_phone: string | null
          product: string
          value: number
          stage: LeadStage
          source: LeadSource
          owner_id: string | null
          expected_close_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['leads']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          author_id: string
          type: ActivityType
          body: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lead_activities']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lead_activities']['Insert']>
      }
      lead_tasks: {
        Row: {
          id: string
          lead_id: string
          assigned_to: string | null
          title: string
          due_date: string | null
          completed: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lead_tasks']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lead_tasks']['Insert']>
      }
      collab_boards: {
        Row: {
          id: string
          project_id: string
          name: string
          excalidraw_data: Record<string, unknown> | null
          updated_by: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['collab_boards']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['collab_boards']['Insert']>
      }
      notes: {
        Row: {
          id: string
          project_id: string | null
          author_id: string
          title: string
          content: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['notes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['notes']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          message: string
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
