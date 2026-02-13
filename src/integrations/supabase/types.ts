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
      alert_notifications: {
        Row: {
          alert_id: string
          id: string
          is_read: boolean
          triggered_at: string
          triggered_value: number
          user_id: string
        }
        Insert: {
          alert_id: string
          id?: string
          is_read?: boolean
          triggered_at?: string
          triggered_value: number
          user_id: string
        }
        Update: {
          alert_id?: string
          id?: string
          is_read?: boolean
          triggered_at?: string
          triggered_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          condition: Database["public"]["Enums"]["alert_condition"]
          created_at: string
          id: string
          is_active: boolean
          is_triggered: boolean
          last_triggered_at: string | null
          notes: string | null
          portfolio_id: string | null
          security_id: string
          threshold: number
          user_id: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          condition: Database["public"]["Enums"]["alert_condition"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_triggered?: boolean
          last_triggered_at?: string | null
          notes?: string | null
          portfolio_id?: string | null
          security_id: string
          threshold: number
          user_id: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          condition?: Database["public"]["Enums"]["alert_condition"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_triggered?: boolean
          last_triggered_at?: string | null
          notes?: string | null
          portfolio_id?: string | null
          security_id?: string
          threshold?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_events: {
        Row: {
          buy_transaction_id: string | null
          capital_gain_amount: number | null
          capital_gain_pct: number | null
          created_at: string
          event_date: string
          id: string
          notes: string | null
          portfolio_id: string
          reinvested_amount: number | null
          security_bought_id: string | null
          security_sold_id: string | null
          sell_transaction_id: string | null
        }
        Insert: {
          buy_transaction_id?: string | null
          capital_gain_amount?: number | null
          capital_gain_pct?: number | null
          created_at?: string
          event_date: string
          id?: string
          notes?: string | null
          portfolio_id: string
          reinvested_amount?: number | null
          security_bought_id?: string | null
          security_sold_id?: string | null
          sell_transaction_id?: string | null
        }
        Update: {
          buy_transaction_id?: string | null
          capital_gain_amount?: number | null
          capital_gain_pct?: number | null
          created_at?: string
          event_date?: string
          id?: string
          notes?: string | null
          portfolio_id?: string
          reinvested_amount?: number | null
          security_bought_id?: string | null
          security_sold_id?: string | null
          sell_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capital_events_buy_transaction_id_fkey"
            columns: ["buy_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_events_security_bought_id_fkey"
            columns: ["security_bought_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_events_security_sold_id_fkey"
            columns: ["security_sold_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_events_sell_transaction_id_fkey"
            columns: ["sell_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_account_summary: {
        Row: {
          cash_balance: number
          created_at: string
          date: string
          id: string
          net_liquidation: number
          user_id: string
        }
        Insert: {
          cash_balance: number
          created_at?: string
          date: string
          id?: string
          net_liquidation: number
          user_id: string
        }
        Update: {
          cash_balance?: number
          created_at?: string
          date?: string
          id?: string
          net_liquidation?: number
          user_id?: string
        }
        Relationships: []
      }
      deep_dive_items: {
        Row: {
          content_markdown: string | null
          created_at: string
          error_message: string | null
          file_path: string | null
          id: string
          security_id: string
          source_type: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          content_markdown?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          id?: string
          security_id: string
          source_type: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          content_markdown?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          id?: string
          security_id?: string
          source_type?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deep_dive_items_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      dividend_history: {
        Row: {
          amount_per_share: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          ex_date: string
          fx_rate_to_base: number
          id: string
          is_roc: boolean
          net_amount: number
          pay_date: string | null
          portfolio_id: string
          record_date: string | null
          security_id: string
          sync_source: Database["public"]["Enums"]["sync_source"]
          total_amount: number
          withholding_tax: number
        }
        Insert: {
          amount_per_share: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          ex_date: string
          fx_rate_to_base?: number
          id?: string
          is_roc?: boolean
          net_amount: number
          pay_date?: string | null
          portfolio_id: string
          record_date?: string | null
          security_id: string
          sync_source?: Database["public"]["Enums"]["sync_source"]
          total_amount: number
          withholding_tax?: number
        }
        Update: {
          amount_per_share?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          ex_date?: string
          fx_rate_to_base?: number
          id?: string
          is_roc?: boolean
          net_amount?: number
          pay_date?: string | null
          portfolio_id?: string
          record_date?: string | null
          security_id?: string
          sync_source?: Database["public"]["Enums"]["sync_source"]
          total_amount?: number
          withholding_tax?: number
        }
        Relationships: [
          {
            foreignKeyName: "dividend_history_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividend_history_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      fundamental_data: {
        Row: {
          created_at: string
          data_date: string
          dividend_cagr_5y: number | null
          dividend_yield: number | null
          earnings_growth_3y: number | null
          earnings_growth_5y: number | null
          id: string
          payout_ratio: number | null
          pe_ratio: number | null
          revenue_growth_3y: number | null
          revenue_growth_5y: number | null
          security_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_date: string
          dividend_cagr_5y?: number | null
          dividend_yield?: number | null
          earnings_growth_3y?: number | null
          earnings_growth_5y?: number | null
          id?: string
          payout_ratio?: number | null
          pe_ratio?: number | null
          revenue_growth_3y?: number | null
          revenue_growth_5y?: number | null
          security_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_date?: string
          dividend_cagr_5y?: number | null
          dividend_yield?: number | null
          earnings_growth_3y?: number | null
          earnings_growth_5y?: number | null
          id?: string
          payout_ratio?: number | null
          pe_ratio?: number | null
          revenue_growth_3y?: number | null
          revenue_growth_5y?: number | null
          security_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fundamental_data_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          created_at: string
          from_currency: Database["public"]["Enums"]["currency_code"]
          id: string
          rate: number
          rate_date: string
          source: string | null
          to_currency: Database["public"]["Enums"]["currency_code"]
        }
        Insert: {
          created_at?: string
          from_currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          rate: number
          rate_date: string
          source?: string | null
          to_currency: Database["public"]["Enums"]["currency_code"]
        }
        Update: {
          created_at?: string
          from_currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          rate?: number
          rate_date?: string
          source?: string | null
          to_currency?: Database["public"]["Enums"]["currency_code"]
        }
        Relationships: []
      }
      ibkr_connections: {
        Row: {
          client_portal_enabled: boolean
          connection_name: string
          created_at: string
          flex_query_id: string | null
          flex_token: string | null
          id: string
          last_sync_at: string | null
          sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_portal_enabled?: boolean
          connection_name: string
          created_at?: string
          flex_query_id?: string | null
          flex_token?: string | null
          id?: string
          last_sync_at?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_portal_enabled?: boolean
          connection_name?: string
          created_at?: string
          flex_query_id?: string | null
          flex_token?: string | null
          id?: string
          last_sync_at?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_data: {
        Row: {
          close_price: number | null
          data_date: string
          id: string
          market_price: number | null
          nav: number | null
          rsi_14: number | null
          security_id: string
          updated_at: string
          z_score: number | null
        }
        Insert: {
          close_price?: number | null
          data_date: string
          id?: string
          market_price?: number | null
          nav?: number | null
          rsi_14?: number | null
          security_id: string
          updated_at?: string
          z_score?: number | null
        }
        Update: {
          close_price?: number | null
          data_date?: string
          id?: string
          market_price?: number | null
          nav?: number | null
          rsi_14?: number | null
          security_id?: string
          updated_at?: string
          z_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_data_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          base_currency: Database["public"]["Enums"]["currency_code"]
          created_at: string
          description: string | null
          ibkr_account_id: string | null
          ibkr_connection_id: string | null
          id: string
          is_active: boolean
          name: string
          strategy: Database["public"]["Enums"]["investor_strategy"]
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          description?: string | null
          ibkr_account_id?: string | null
          ibkr_connection_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          strategy?: Database["public"]["Enums"]["investor_strategy"]
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          description?: string | null
          ibkr_account_id?: string | null
          ibkr_connection_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          strategy?: Database["public"]["Enums"]["investor_strategy"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_ibkr_connection_id_fkey"
            columns: ["ibkr_connection_id"]
            isOneToOne: false
            referencedRelation: "ibkr_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          avg_cost_basis: number
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          last_updated: string
          portfolio_id: string
          quantity: number
          security_id: string
          total_cost_basis: number
        }
        Insert: {
          avg_cost_basis?: number
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          last_updated?: string
          portfolio_id: string
          quantity?: number
          security_id: string
          total_cost_basis?: number
        }
        Update: {
          avg_cost_basis?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          last_updated?: string
          portfolio_id?: string
          quantity?: number
          security_id?: string
          total_cost_basis?: number
        }
        Relationships: [
          {
            foreignKeyName: "positions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          base_currency: Database["public"]["Enums"]["currency_code"]
          created_at: string
          default_strategy: Database["public"]["Enums"]["investor_strategy"]
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          working_capital_gain_max: number | null
          working_capital_gain_min: number | null
        }
        Insert: {
          base_currency?: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          default_strategy?: Database["public"]["Enums"]["investor_strategy"]
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          working_capital_gain_max?: number | null
          working_capital_gain_min?: number | null
        }
        Update: {
          base_currency?: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          default_strategy?: Database["public"]["Enums"]["investor_strategy"]
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          working_capital_gain_max?: number | null
          working_capital_gain_min?: number | null
        }
        Relationships: []
      }
      scoring_weights: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          w_52w_range: number
          w_dividend_cagr: number
          w_fundamental: number
          w_payout_ratio: number
          w_pe: number
          w_revenue_growth: number
          w_rsi: number
          w_technical: number
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          w_52w_range?: number
          w_dividend_cagr?: number
          w_fundamental?: number
          w_payout_ratio?: number
          w_pe?: number
          w_revenue_growth?: number
          w_rsi?: number
          w_technical?: number
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          w_52w_range?: number
          w_dividend_cagr?: number
          w_fundamental?: number
          w_payout_ratio?: number
          w_pe?: number
          w_revenue_growth?: number
          w_rsi?: number
          w_technical?: number
        }
        Relationships: []
      }
      securities: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          conid: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          dividend_frequency: string | null
          exchange: string | null
          id: string
          industry: string | null
          is_active: boolean
          isin: string | null
          name: string | null
          sector: string | null
          ticker: string
          updated_at: string
        }
        Insert: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          conid?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          dividend_frequency?: string | null
          exchange?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          isin?: string | null
          name?: string | null
          sector?: string | null
          ticker: string
          updated_at?: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          conid?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          dividend_frequency?: string | null
          exchange?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          isin?: string | null
          name?: string | null
          sector?: string | null
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_scores: {
        Row: {
          dividend_cagr_score: number | null
          fundamental_score: number | null
          id: string
          inputs_json: Json | null
          payout_score: number | null
          pe_score: number | null
          range_52w_score: number | null
          revenue_growth_score: number | null
          rsi_score: number | null
          scored_at: string
          security_id: string
          technical_score: number | null
          total_score: number | null
          user_id: string
        }
        Insert: {
          dividend_cagr_score?: number | null
          fundamental_score?: number | null
          id?: string
          inputs_json?: Json | null
          payout_score?: number | null
          pe_score?: number | null
          range_52w_score?: number | null
          revenue_growth_score?: number | null
          rsi_score?: number | null
          scored_at?: string
          security_id: string
          technical_score?: number | null
          total_score?: number | null
          user_id: string
        }
        Update: {
          dividend_cagr_score?: number | null
          fundamental_score?: number | null
          id?: string
          inputs_json?: Json | null
          payout_score?: number | null
          pe_score?: number | null
          range_52w_score?: number | null
          revenue_growth_score?: number | null
          rsi_score?: number | null
          scored_at?: string
          security_id?: string
          technical_score?: number | null
          total_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_scores_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          ibkr_connection_id: string | null
          id: string
          records_created: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string
          status: string
          sync_source: Database["public"]["Enums"]["sync_source"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          ibkr_connection_id?: string | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
          sync_source: Database["public"]["Enums"]["sync_source"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          ibkr_connection_id?: string | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
          sync_source?: Database["public"]["Enums"]["sync_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_ibkr_connection_id_fkey"
            columns: ["ibkr_connection_id"]
            isOneToOne: false
            referencedRelation: "ibkr_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          id: string
          price: number
          quantity: number
          realized_pnl: number | null
          side: string
          symbol: string
          trade_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          quantity: number
          realized_pnl?: number | null
          side: string
          symbol: string
          trade_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          quantity?: number
          realized_pnl?: number | null
          side?: string
          symbol?: string
          trade_date?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          commission: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          fx_rate_to_base: number
          gross_amount: number
          ibkr_trade_id: string | null
          id: string
          net_amount: number
          notes: string | null
          portfolio_id: string
          price: number
          quantity: number
          security_id: string
          settlement_date: string | null
          sync_source: Database["public"]["Enums"]["sync_source"]
          trade_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          commission?: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          fx_rate_to_base?: number
          gross_amount: number
          ibkr_trade_id?: string | null
          id?: string
          net_amount: number
          notes?: string | null
          portfolio_id: string
          price: number
          quantity: number
          security_id: string
          settlement_date?: string | null
          sync_source?: Database["public"]["Enums"]["sync_source"]
          trade_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          commission?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          fx_rate_to_base?: number
          gross_amount?: number
          ibkr_trade_id?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          portfolio_id?: string
          price?: number
          quantity?: number
          security_id?: string
          settlement_date?: string | null
          sync_source?: Database["public"]["Enums"]["sync_source"]
          trade_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          added_at: string
          id: string
          notes: string | null
          security_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          notes?: string | null
          security_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          notes?: string | null
          security_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_security_score: {
        Args: { p_security_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      alert_condition: "ABOVE" | "BELOW" | "CROSSES_ABOVE" | "CROSSES_BELOW"
      alert_type: "PRICE" | "DISCOUNT_TO_NAV" | "RSI" | "Z_SCORE"
      asset_class:
        | "CEF"
        | "BDC"
        | "REIT"
        | "ETF"
        | "PREFERRED"
        | "BABY_BOND"
        | "OTHER"
      currency_code:
        | "USD"
        | "EUR"
        | "CAD"
        | "GBP"
        | "CHF"
        | "AUD"
        | "JPY"
        | "SEK"
        | "NOK"
        | "DKK"
      investor_strategy: "BUY_AND_HOLD" | "WORKING_CAPITAL_GROWTH"
      sync_source: "FLEX_QUERY" | "CLIENT_PORTAL" | "MANUAL"
      transaction_type:
        | "BUY"
        | "SELL"
        | "DIVIDEND"
        | "ROC"
        | "SPLIT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
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
      alert_condition: ["ABOVE", "BELOW", "CROSSES_ABOVE", "CROSSES_BELOW"],
      alert_type: ["PRICE", "DISCOUNT_TO_NAV", "RSI", "Z_SCORE"],
      asset_class: [
        "CEF",
        "BDC",
        "REIT",
        "ETF",
        "PREFERRED",
        "BABY_BOND",
        "OTHER",
      ],
      currency_code: [
        "USD",
        "EUR",
        "CAD",
        "GBP",
        "CHF",
        "AUD",
        "JPY",
        "SEK",
        "NOK",
        "DKK",
      ],
      investor_strategy: ["BUY_AND_HOLD", "WORKING_CAPITAL_GROWTH"],
      sync_source: ["FLEX_QUERY", "CLIENT_PORTAL", "MANUAL"],
      transaction_type: [
        "BUY",
        "SELL",
        "DIVIDEND",
        "ROC",
        "SPLIT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ],
    },
  },
} as const
