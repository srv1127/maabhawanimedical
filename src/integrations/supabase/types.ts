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
      advisor_sessions: {
        Row: {
          advice: string | null
          age_years: number | null
          allergies: string | null
          assessment: string | null
          conditions: string | null
          created_at: string
          created_by: string
          id: string
          inventory_size: number | null
          pregnant: boolean | null
          red_flags: string[] | null
          sex: string | null
          symptoms: string
        }
        Insert: {
          advice?: string | null
          age_years?: number | null
          allergies?: string | null
          assessment?: string | null
          conditions?: string | null
          created_at?: string
          created_by: string
          id?: string
          inventory_size?: number | null
          pregnant?: boolean | null
          red_flags?: string[] | null
          sex?: string | null
          symptoms: string
        }
        Update: {
          advice?: string | null
          age_years?: number | null
          allergies?: string | null
          assessment?: string | null
          conditions?: string | null
          created_at?: string
          created_by?: string
          id?: string
          inventory_size?: number | null
          pregnant?: boolean | null
          red_flags?: string[] | null
          sex?: string | null
          symptoms?: string
        }
        Relationships: []
      }
      advisor_suggestions: {
        Row: {
          cautions: string | null
          confidence: string | null
          created_at: string
          dosage: string | null
          duration: string | null
          id: string
          medicine_id: string | null
          name: string
          rank: number
          reason: string | null
          selling_price: number
          session_id: string
          stock_qty: number
        }
        Insert: {
          cautions?: string | null
          confidence?: string | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          id?: string
          medicine_id?: string | null
          name: string
          rank?: number
          reason?: string | null
          selling_price?: number
          session_id: string
          stock_qty?: number
        }
        Update: {
          cautions?: string | null
          confidence?: string | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          id?: string
          medicine_id?: string | null
          name?: string
          rank?: number
          reason?: string | null
          selling_price?: number
          session_id?: string
          stock_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "advisor_suggestions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "advisor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      daily_closings: {
        Row: {
          card_total: number
          cash_total: number
          closing_cash: number
          closing_date: string
          created_at: string
          created_by: string | null
          credit_total: number
          expenses: number
          id: string
          notes: string | null
          opening_cash: number
          total_invoices: number
          total_profit: number
          total_sales: number
          upi_total: number
        }
        Insert: {
          card_total?: number
          cash_total?: number
          closing_cash?: number
          closing_date?: string
          created_at?: string
          created_by?: string | null
          credit_total?: number
          expenses?: number
          id?: string
          notes?: string | null
          opening_cash?: number
          total_invoices?: number
          total_profit?: number
          total_sales?: number
          upi_total?: number
        }
        Update: {
          card_total?: number
          cash_total?: number
          closing_cash?: number
          closing_date?: string
          created_at?: string
          created_by?: string | null
          credit_total?: number
          expenses?: number
          id?: string
          notes?: string | null
          opening_cash?: number
          total_invoices?: number
          total_profit?: number
          total_sales?: number
          upi_total?: number
        }
        Relationships: []
      }
      medicines: {
        Row: {
          barcode: string | null
          batch_no: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          expiry_date: string | null
          generic_name: string | null
          gst_percent: number
          hsn_code: string | null
          id: string
          image_url: string | null
          is_active: boolean
          location: string | null
          manufacturer: string | null
          mrp: number
          name: string
          notes: string | null
          pack_size: number
          purchase_price: number
          reorder_level: number
          selling_price: number
          stock_qty: number
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          batch_no?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          generic_name?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          manufacturer?: string | null
          mrp?: number
          name: string
          notes?: string | null
          pack_size?: number
          purchase_price?: number
          reorder_level?: number
          selling_price?: number
          stock_qty?: number
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          batch_no?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          generic_name?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          manufacturer?: string | null
          mrp?: number
          name?: string
          notes?: string | null
          pack_size?: number
          purchase_price?: number
          reorder_level?: number
          selling_price?: number
          stock_qty?: number
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_uploads: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          extracted: Json | null
          id: string
          image_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          image_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          image_url?: string | null
          status?: string
        }
        Relationships: []
      }
      physical_count_items: {
        Row: {
          count_id: string
          counted_qty: number
          difference: number | null
          id: string
          medicine_id: string
          notes: string | null
          system_qty: number
        }
        Insert: {
          count_id: string
          counted_qty: number
          difference?: number | null
          id?: string
          medicine_id: string
          notes?: string | null
          system_qty: number
        }
        Update: {
          count_id?: string
          counted_qty?: number
          difference?: number | null
          id?: string
          medicine_id?: string
          notes?: string | null
          system_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "physical_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "physical_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_count_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_counts: {
        Row: {
          count_date: string
          created_at: string
          created_by: string | null
          finalized_at: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["count_status"]
          updated_at: string
        }
        Insert: {
          count_date?: string
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          updated_at?: string
        }
        Update: {
          count_date?: string
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          discount: number
          gst_percent: number
          id: string
          line_total: number
          medicine_id: string
          mrp: number
          purchase_price: number
          qty: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number
          gst_percent?: number
          id?: string
          line_total: number
          medicine_id: string
          mrp?: number
          purchase_price?: number
          qty: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          discount?: number
          gst_percent?: number
          id?: string
          line_total?: number
          medicine_id?: string
          mrp?: number
          purchase_price?: number
          qty?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number
          doctor_name: string | null
          id: string
          invoice_no: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          profit: number
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          doctor_name?: string | null
          id?: string
          invoice_no: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          profit?: number
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          doctor_name?: string | null
          id?: string
          invoice_no?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          profit?: number
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          change_qty: number
          created_at: string
          created_by: string | null
          id: string
          medicine_id: string
          notes: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          change_qty: number
          created_at?: string
          created_by?: string | null
          id?: string
          medicine_id: string
          notes?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          change_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          medicine_id?: string
          notes?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      next_invoice_no: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "pharmacist" | "cashier"
      count_status: "draft" | "finalized"
      movement_type:
        | "purchase"
        | "sale"
        | "adjustment"
        | "return"
        | "expired"
        | "damaged"
      payment_method: "cash" | "card" | "upi" | "credit"
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
      app_role: ["admin", "pharmacist", "cashier"],
      count_status: ["draft", "finalized"],
      movement_type: [
        "purchase",
        "sale",
        "adjustment",
        "return",
        "expired",
        "damaged",
      ],
      payment_method: ["cash", "card", "upi", "credit"],
    },
  },
} as const
