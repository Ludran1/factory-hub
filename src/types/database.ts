export type UserRole = 'admin' | 'developer' | 'support' | 'closer' | 'marketing'

export type TaskPriority = 'urgente' | 'importante' | 'alta' | 'media' | 'baja' | 'delegar'
export type TaskStatus = 'todo' | 'in_progress' | 'code_review' | 'done'

export type TicketPriority = 'urgente' | 'alta' | 'media' | 'baja'
export type TicketStatus = 'Abierto' | 'En Revisión' | 'Resuelto'

export type LeadStage = 'prospecto' | 'demo' | 'negociacion' | 'cerrado'
export type LeadSource = 'referido' | 'cold_outreach' | 'sitio_web' | 'evento' | 'redes_sociales' | 'otro'
export type ActivityType = 'llamada' | 'reunion' | 'email' | 'nota' | 'whatsapp'
export type ProjectMemberRole = 'owner' | 'contributor'

export type Currency = 'PEN' | 'USD'
export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'vencida'
export type QuoteEventType = 'creada' | 'enviada' | 'vista' | 'aceptada' | 'rechazada' | 'revisada'

export type Quote = Database['public']['Tables']['quotes']['Row']
/** Lo que el cliente puede escribir: sin correlativo ni totales, que son del servidor. */
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update']
export type QuoteItem = Database['public']['Tables']['quote_items']['Row']
export type QuoteEvent = Database['public']['Tables']['quote_events']['Row']
export type OrgSettings = Database['public']['Tables']['org_settings']['Row']

export interface QuoteEmitter {
  legal_name: string
  ruc: string
  address: string | null
  email: string | null
  phone: string | null
  website: string | null
  logo_base64: string | null
}

/** Lo que devuelve get_public_quote: sin token, owner, lead ni total_pen. */
export interface PublicQuotePayload {
  quote: Omit<Quote, 'public_token' | 'owner_id' | 'lead_id' | 'parent_quote_id' | 'total_pen'>
  items: QuoteItem[]
  emitter: QuoteEmitter
  expired: boolean
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          avatar_url: string | null
          role: UserRole
          allowed_modules: string[]
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
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
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          profile_id: string
          role: ProjectMemberRole
          added_at: string
        }
        Insert: Omit<Database['public']['Tables']['project_members']['Row'], 'id' | 'added_at'>
        Update: Partial<Database['public']['Tables']['project_members']['Insert']>
        Relationships: []
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
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          objective_id: string
          title: string
          priority: TaskPriority
          status: TaskStatus
          assignee_id: string | null
          due_date: string | null
          time_spent_seconds: number
          timer_started_at: string | null
          description: unknown | null
          /** Columna generada (description is not null). Las listas piden esto, no el contenido. */
          has_description: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at' | 'has_description'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          company: string
          contact_name: string
          contact_email: string | null
          contact_phone: string | null
          product: string
          /** Columna generada desde contact_phone. La app nunca la escribe. */
          phone_e164: string | null
          /** business_scoped_user_id de WhatsApp. Puede existir sin teléfono. */
          whatsapp_bsuid: string | null
          whatsapp_username: string | null
          value: number
          currency: Currency
          value_pen: number
          stage: LeadStage
          source: LeadSource
          owner_id: string | null
          expected_close_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        // currency y value_pen tienen default en la DB y normalmente los escribe
        // respond_quote al aceptar una cotización, no el formulario de lead.
        Insert:
          & Omit<Database['public']['Tables']['leads']['Row'], 'id' | 'created_at' | 'updated_at' | 'currency' | 'value_pen' | 'phone_e164' | 'whatsapp_bsuid' | 'whatsapp_username'>
          & Partial<Pick<Database['public']['Tables']['leads']['Row'], 'currency' | 'value_pen' | 'whatsapp_bsuid' | 'whatsapp_username'>>
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
        Relationships: []
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          /** null = lo registró el cliente o una automatización (webhook de WhatsApp). */
          author_id: string | null
          external_id: string | null
          type: ActivityType
          body: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lead_activities']['Row'], 'id' | 'created_at' | 'external_id'> & Partial<Pick<Database['public']['Tables']['lead_activities']['Row'], 'external_id'>>
        Update: Partial<Database['public']['Tables']['lead_activities']['Insert']>
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      task_assignees: {
        Row: {
          task_id: string
          profile_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_assignees']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['task_assignees']['Insert']>
        Relationships: []
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
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          lead_id: string | null
          number: string
          version: number
          parent_quote_id: string | null
          client_company: string
          client_contact: string | null
          client_email: string | null
          client_phone: string | null
          /** Columna generada desde client_phone. La app nunca la escribe. */
          client_phone_e164: string | null
          client_doc: string | null
          client_address: string | null
          title: string
          currency: Currency
          fx_rate: number
          issue_date: string
          valid_until: string | null
          status: QuoteStatus
          igv_rate: number
          subtotal: number
          discount: number
          igv: number
          total: number
          total_pen: number
          terms: string | null
          owner_id: string | null
          public_token: string
          sent_at: string | null
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        // number lo asigna un trigger; los totales los calcula otro. Nada de eso
        // se manda desde el cliente (ver supabase/migrations/20260911120000_quotes.sql).
        Insert:
          & Omit<
              Database['public']['Tables']['quotes']['Row'],
              'id' | 'number' | 'version' | 'subtotal' | 'discount' | 'igv' | 'total' | 'total_pen'
              | 'public_token' | 'status' | 'issue_date' | 'igv_rate' | 'fx_rate' | 'currency'
              | 'parent_quote_id' | 'sent_at' | 'accepted_at' | 'created_at' | 'updated_at'
              | 'client_phone_e164'
            >
          & Partial<Pick<
              Database['public']['Tables']['quotes']['Row'],
              'version' | 'status' | 'issue_date' | 'igv_rate' | 'fx_rate' | 'currency' | 'parent_quote_id'
            >>
        Update: Partial<Database['public']['Tables']['quotes']['Insert'] & {
          status: QuoteStatus
          sent_at: string | null
          accepted_at: string | null
        }>
        Relationships: []
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          description: string
          detail: string | null
          qty: number
          unit_price: number
          discount: number
          position: number
        }
        Insert: Omit<Database['public']['Tables']['quote_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['quote_items']['Insert']>
        Relationships: []
      }
      quote_events: {
        Row: {
          id: string
          quote_id: string
          type: QuoteEventType
          actor_id: string | null
          meta: Record<string, unknown> | null
          created_at: string
        }
        // Solo los escribe el servidor: quote_events no tiene policy de insert.
        Insert: never
        Update: never
        Relationships: []
      }
      org_settings: {
        Row: {
          id: boolean
          legal_name: string
          ruc: string
          address: string | null
          email: string | null
          phone: string | null
          website: string | null
          logo_base64: string | null
          default_terms: string | null
          updated_at: string
        }
        Insert: never
        Update: Partial<Omit<Database['public']['Tables']['org_settings']['Row'], 'id'>>
        Relationships: []
      }
      fx_rates: {
        Row: {
          date: string
          usd_pen: number
          source: string
          fetched_at: string
        }
        // La escribe solo la Edge Function fx-rate con service role.
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_quote: {
        Args: { p_token: string }
        Returns: PublicQuotePayload | null
      }
      log_quote_view: {
        Args: { p_token: string }
        Returns: void
      }
      respond_quote: {
        Args: { p_token: string; p_accept: boolean; p_signer: string }
        Returns: { ok: boolean; error?: string }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
