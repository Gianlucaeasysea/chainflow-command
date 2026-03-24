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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bom_headers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_lines: {
        Row: {
          bom_header_id: string
          component_item_id: string
          created_at: string
          id: string
          notes: string | null
          quantity: number
          sort_order: number
          waste_pct: number
        }
        Insert: {
          bom_header_id: string
          component_item_id: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          waste_pct?: number
        }
        Update: {
          bom_header_id?: string
          component_item_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_bom_header_id_fkey"
            columns: ["bom_header_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_history: {
        Row: {
          amount: number
          cost_type: string
          created_at: string
          currency: string | null
          effective_date: string
          id: string
          item_id: string
          source: string | null
        }
        Insert: {
          amount: number
          cost_type: string
          created_at?: string
          currency?: string | null
          effective_date?: string
          id?: string
          item_id: string
          source?: string | null
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string
          currency?: string | null
          effective_date?: string
          id?: string
          item_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          coa_url: string | null
          created_at: string
          expiry_date: string | null
          id: string
          item_id: string
          lot_number: string
          notes: string | null
          production_date: string | null
          purchase_order_id: string | null
          quantity_on_hand: number
          status: string
          supplier_lot_number: string | null
          updated_at: string
        }
        Insert: {
          coa_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id: string
          lot_number: string
          notes?: string | null
          production_date?: string | null
          purchase_order_id?: string | null
          quantity_on_hand?: number
          status?: string
          supplier_lot_number?: string | null
          updated_at?: string
        }
        Update: {
          coa_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id?: string
          lot_number?: string
          notes?: string | null
          production_date?: string | null
          purchase_order_id?: string | null
          quantity_on_hand?: number
          status?: string
          supplier_lot_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          assembly_cost: number | null
          category: string | null
          created_at: string
          description: string
          drive_folder_url: string | null
          id: string
          image_url: string | null
          item_code: string
          item_type: string | null
          notes: string | null
          technical_file_urls: string[] | null
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          assembly_cost?: number | null
          category?: string | null
          created_at?: string
          description: string
          drive_folder_url?: string | null
          id?: string
          image_url?: string | null
          item_code: string
          item_type?: string | null
          notes?: string | null
          technical_file_urls?: string[] | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          assembly_cost?: number | null
          category?: string | null
          created_at?: string
          description?: string
          drive_folder_url?: string | null
          id?: string
          image_url?: string | null
          item_code?: string
          item_type?: string | null
          notes?: string | null
          technical_file_urls?: string[] | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      po_deliveries: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          delivery_group_id: string | null
          destination: string | null
          id: string
          notes: string | null
          po_line_id: string | null
          purchase_order_id: string
          quantity: number
          scheduled_date: string
          status: string
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          delivery_group_id?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          po_line_id?: string | null
          purchase_order_id: string
          quantity?: number
          scheduled_date: string
          status?: string
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          delivery_group_id?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          po_line_id?: string | null
          purchase_order_id?: string
          quantity?: number
          scheduled_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_deliveries_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "po_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_deliveries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_lines: {
        Row: {
          created_at: string
          discount_pct: number | null
          id: string
          item_id: string
          line_total: number | null
          notes: string | null
          purchase_order_id: string
          quantity: number
          sort_order: number | null
          supplier_item_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_pct?: number | null
          id?: string
          item_id: string
          line_total?: number | null
          notes?: string | null
          purchase_order_id: string
          quantity: number
          sort_order?: number | null
          supplier_item_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_pct?: number | null
          id?: string
          item_id?: string
          line_total?: number | null
          notes?: string | null
          purchase_order_id?: string
          quantity?: number
          sort_order?: number | null
          supplier_item_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_supplier_item_id_fkey"
            columns: ["supplier_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_items"
            referencedColumns: ["id"]
          },
        ]
      }
      po_status_history: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_status_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          bom_header_id: string | null
          created_at: string
          id: string
          notes: string | null
          planned_end: string | null
          planned_start: string | null
          priority: string | null
          product_item_id: string
          quantity_to_produce: number
          status: string
          updated_at: string
          wo_number: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          bom_header_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string | null
          product_item_id: string
          quantity_to_produce: number
          status?: string
          updated_at?: string
          wo_number: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          bom_header_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string | null
          product_item_id?: string
          quantity_to_produce?: number
          status?: string
          updated_at?: string
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_bom_header_id_fkey"
            columns: ["bom_header_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          currency: string | null
          id: string
          incoterm: string | null
          notes: string | null
          order_date: string | null
          po_number: string
          product_item_id: string | null
          requested_delivery_date: string | null
          shipping_port: string | null
          status: string
          supplier_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          incoterm?: string | null
          notes?: string | null
          order_date?: string | null
          po_number: string
          product_item_id?: string | null
          requested_delivery_date?: string | null
          shipping_port?: string | null
          status?: string
          supplier_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          incoterm?: string | null
          notes?: string | null
          order_date?: string | null
          po_number?: string
          product_item_id?: string | null
          requested_delivery_date?: string | null
          shipping_port?: string | null
          status?: string
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_params: {
        Row: {
          created_at: string
          eoq: number | null
          id: string
          item_id: string
          management_type: string | null
          max_stock: number | null
          reorder_point: number | null
          safety_stock: number | null
          service_level: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          eoq?: number | null
          id?: string
          item_id: string
          management_type?: string | null
          max_stock?: number | null
          reorder_point?: number | null
          safety_stock?: number | null
          service_level?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          eoq?: number | null
          id?: string
          item_id?: string
          management_type?: string | null
          max_stock?: number | null
          reorder_point?: number | null
          safety_stock?: number | null
          service_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reorder_params_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          item_id: string
          lot_number: string | null
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          warehouse: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          lot_number?: string | null
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          warehouse?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          lot_number?: string | null
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_certifications: {
        Row: {
          certification_name: string
          created_at: string
          document_url: string | null
          expiry_date: string | null
          id: string
          issued_date: string | null
          supplier_id: string
        }
        Insert: {
          certification_name: string
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          supplier_id: string
        }
        Update: {
          certification_name?: string
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_certifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_items: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          item_id: string
          lead_time_days: number | null
          moq: number | null
          notes: string | null
          order_multiple: number | null
          supplier_id: string
          supplier_item_code: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          item_id: string
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          order_multiple?: number | null
          supplier_id: string
          supplier_item_code?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          item_id?: string
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          order_multiple?: number | null
          supplier_id?: string
          supplier_item_code?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          country: string | null
          created_at: string
          currency: string | null
          id: string
          incoterm: string | null
          is_active: boolean
          notes: string | null
          payment_terms: string | null
          rating: number | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          incoterm?: string | null
          is_active?: boolean
          notes?: string | null
          payment_terms?: string | null
          rating?: number | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          incoterm?: string | null
          is_active?: boolean
          notes?: string | null
          payment_terms?: string | null
          rating?: number | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
