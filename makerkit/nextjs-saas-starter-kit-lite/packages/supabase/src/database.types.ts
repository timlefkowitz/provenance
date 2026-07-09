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
      accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          name: string
          picture_url: string | null
          public_data: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          picture_url?: string | null
          public_data?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          picture_url?: string | null
          public_data?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      acquisitions: {
        Row: {
          accession_number: string | null
          account_id: string
          acquisition_date: string | null
          acquisition_price_cents: number | null
          acquisition_type: string
          artwork_id: string
          created_at: string
          currency: string
          document_storage_path: string | null
          fund_source: string | null
          id: string
          legal_status: string
          provenance_notes: string | null
          seller_email: string | null
          seller_name: string
          seller_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accession_number?: string | null
          account_id: string
          acquisition_date?: string | null
          acquisition_price_cents?: number | null
          acquisition_type?: string
          artwork_id: string
          created_at?: string
          currency?: string
          document_storage_path?: string | null
          fund_source?: string | null
          id?: string
          legal_status?: string
          provenance_notes?: string | null
          seller_email?: string | null
          seller_name?: string
          seller_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accession_number?: string | null
          account_id?: string
          acquisition_date?: string | null
          acquisition_price_cents?: number | null
          acquisition_type?: string
          artwork_id?: string
          created_at?: string
          currency?: string
          document_storage_path?: string | null
          fund_source?: string | null
          id?: string
          legal_status?: string
          provenance_notes?: string | null
          seller_email?: string | null
          seller_name?: string
          seller_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisitions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisitions_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisitions_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_contacts: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          display_name: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          source: string
          updated_at: string
          website: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      admin_outreach_sends: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          quality: string | null
          sent_by: string | null
          skip_reason: string | null
          status: string
          template_key: string
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          quality?: string | null
          sent_by?: string | null
          skip_reason?: string | null
          status: string
          template_key?: string
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          quality?: string | null
          sent_by?: string | null
          skip_reason?: string | null
          status?: string
          template_key?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          account_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          last_used_at: string | null
          name: string
          planet: string | null
          rate_limit: number | null
          scopes: string[] | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          last_used_at?: string | null
          name: string
          planet?: string | null
          rate_limit?: number | null
          scopes?: string[] | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          last_used_at?: string | null
          name?: string
          planet?: string | null
          rate_limit?: number | null
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_grants: {
        Row: {
          amount: string | null
          artist_profile_id: string | null
          bookmarked: boolean
          created_at: string
          deadline: string | null
          description: string | null
          discipline: string[] | null
          eligible_locations: string[] | null
          id: string
          is_community: boolean
          name: string
          raw_response: Json | null
          shared_by: string | null
          shared_by_name: string | null
          source: string | null
          type: string
          updated_at: string
          upvote_count: number
          url: string | null
          user_id: string | null
        }
        Insert: {
          amount?: string | null
          artist_profile_id?: string | null
          bookmarked?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          discipline?: string[] | null
          eligible_locations?: string[] | null
          id?: string
          is_community?: boolean
          name: string
          raw_response?: Json | null
          shared_by?: string | null
          shared_by_name?: string | null
          source?: string | null
          type?: string
          updated_at?: string
          upvote_count?: number
          url?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: string | null
          artist_profile_id?: string | null
          bookmarked?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          discipline?: string[] | null
          eligible_locations?: string[] | null
          id?: string
          is_community?: boolean
          name?: string
          raw_response?: Json | null
          shared_by?: string | null
          shared_by_name?: string | null
          source?: string | null
          type?: string
          updated_at?: string
          upvote_count?: number
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_grants_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_leads: {
        Row: {
          artist_user_id: string
          artwork_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          estimated_value: number | null
          follow_up_date: string | null
          id: string
          intel: Json
          is_lead: boolean
          notes: string | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          artist_user_id: string
          artwork_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          estimated_value?: number | null
          follow_up_date?: string | null
          id?: string
          intel?: Json
          is_lead?: boolean
          notes?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          artist_user_id?: string
          artwork_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          estimated_value?: number | null
          follow_up_date?: string | null
          id?: string
          intel?: Json
          is_lead?: boolean
          notes?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_leads_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_leads_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profile_claims: {
        Row: {
          artist_user_id: string
          created_at: string
          gallery_id: string
          gallery_response: string | null
          id: string
          message: string | null
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          artist_user_id: string
          created_at?: string
          gallery_id: string
          gallery_response?: string | null
          id?: string
          message?: string | null
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          artist_user_id?: string
          created_at?: string
          gallery_id?: string
          gallery_response?: string | null
          id?: string
          message?: string | null
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_profile_claims_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_profile_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_attachments: {
        Row: {
          account_id: string
          artwork_id: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          is_public: boolean
          label: string | null
        }
        Insert: {
          account_id: string
          artwork_id: string
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          is_public?: boolean
          label?: string | null
        }
        Update: {
          account_id?: string
          artwork_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          is_public?: boolean
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_attachments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_attachments_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_attachments_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_favorites: {
        Row: {
          artwork_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          artwork_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          artwork_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artwork_favorites_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_favorites_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_inquiries: {
        Row: {
          artwork_id: string
          created_at: string
          email: string
          id: string
          inquiry_type: string
          message: string | null
          name: string
          owner_account_id: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          artwork_id: string
          created_at?: string
          email: string
          id?: string
          inquiry_type: string
          message?: string | null
          name: string
          owner_account_id: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          artwork_id?: string
          created_at?: string
          email?: string
          id?: string
          inquiry_type?: string
          message?: string | null
          name?: string
          owner_account_id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_inquiries_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_inquiries_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_inquiries_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_loan_agreements: {
        Row: {
          account_id: string
          artwork_id: string
          borrower_email: string | null
          borrower_name: string
          conditions_text: string | null
          created_at: string
          document_storage_path: string | null
          end_date: string | null
          id: string
          insurance_requirements_text: string | null
          lender_email: string | null
          lender_name: string | null
          signature_completed_at: string | null
          signature_notes: string | null
          start_date: string | null
          status: string
          terms_text: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          artwork_id: string
          borrower_email?: string | null
          borrower_name?: string
          conditions_text?: string | null
          created_at?: string
          document_storage_path?: string | null
          end_date?: string | null
          id?: string
          insurance_requirements_text?: string | null
          lender_email?: string | null
          lender_name?: string | null
          signature_completed_at?: string | null
          signature_notes?: string | null
          start_date?: string | null
          status?: string
          terms_text?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          artwork_id?: string
          borrower_email?: string | null
          borrower_name?: string
          conditions_text?: string | null
          created_at?: string
          document_storage_path?: string | null
          end_date?: string | null
          id?: string
          insurance_requirements_text?: string | null
          lender_email?: string | null
          lender_name?: string | null
          signature_completed_at?: string | null
          signature_notes?: string | null
          start_date?: string | null
          status?: string
          terms_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artwork_loan_agreements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_loan_agreements_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_loan_agreements_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_locations: {
        Row: {
          account_id: string
          artwork_id: string
          crate_label: string | null
          created_at: string
          custodian_email: string | null
          custodian_name: string | null
          custodian_user_id: string | null
          id: string
          location_name: string | null
          location_type: string
          moved_at: string | null
          notes: string | null
          room: string | null
          shelf: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          artwork_id: string
          crate_label?: string | null
          created_at?: string
          custodian_email?: string | null
          custodian_name?: string | null
          custodian_user_id?: string | null
          id?: string
          location_name?: string | null
          location_type?: string
          moved_at?: string | null
          notes?: string | null
          room?: string | null
          shelf?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          artwork_id?: string
          crate_label?: string | null
          created_at?: string
          custodian_email?: string | null
          custodian_name?: string | null
          custodian_user_id?: string | null
          id?: string
          location_name?: string | null
          location_type?: string
          moved_at?: string | null
          notes?: string | null
          room?: string | null
          shelf?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artwork_locations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_locations_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_locations_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_shipments: {
        Row: {
          account_id: string
          actual_arrival: string | null
          alert_sent_at: string | null
          artwork_id: string
          courier_contact_email: string | null
          courier_name: string
          courier_user_id: string | null
          crating_notes: string | null
          created_at: string
          destination_location: string | null
          document_storage_path: string | null
          estimated_arrival: string | null
          id: string
          origin_location: string | null
          ship_date: string | null
          status: string
          tracking_number: string | null
          transit_insurance_policy: string | null
          transit_insurance_value_cents: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          actual_arrival?: string | null
          alert_sent_at?: string | null
          artwork_id: string
          courier_contact_email?: string | null
          courier_name?: string
          courier_user_id?: string | null
          crating_notes?: string | null
          created_at?: string
          destination_location?: string | null
          document_storage_path?: string | null
          estimated_arrival?: string | null
          id?: string
          origin_location?: string | null
          ship_date?: string | null
          status?: string
          tracking_number?: string | null
          transit_insurance_policy?: string | null
          transit_insurance_value_cents?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          actual_arrival?: string | null
          alert_sent_at?: string | null
          artwork_id?: string
          courier_contact_email?: string | null
          courier_name?: string
          courier_user_id?: string | null
          crating_notes?: string | null
          created_at?: string
          destination_location?: string | null
          document_storage_path?: string | null
          estimated_arrival?: string | null
          id?: string
          origin_location?: string | null
          ship_date?: string | null
          status?: string
          tracking_number?: string | null
          transit_insurance_policy?: string | null
          transit_insurance_value_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artwork_shipments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_shipments_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_shipments_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_valuations: {
        Row: {
          artist_market_cap_cents: number | null
          artwork_id: string
          auction_history_summary: Json
          condition: string | null
          confidence_high_cents: number | null
          confidence_low_cents: number | null
          cultural_importance_score: number | null
          engine_version: string
          estimated_value_cents: number | null
          exhibition_count: number | null
          forgery_risk_score: number | null
          former_owners_count: number | null
          generated_at: string
          generated_by: string | null
          id: string
          is_public: boolean
          liquidity_score: number | null
          llm_model: string | null
          market_signals: Json
          medium: string | null
          museum_count: number | null
          museum_presence_count: number | null
          narrative: string | null
          notable_collectors_count: number | null
          rarity_index: number | null
          scholarly_citations_count: number | null
        }
        Insert: {
          artist_market_cap_cents?: number | null
          artwork_id: string
          auction_history_summary?: Json
          condition?: string | null
          confidence_high_cents?: number | null
          confidence_low_cents?: number | null
          cultural_importance_score?: number | null
          engine_version?: string
          estimated_value_cents?: number | null
          exhibition_count?: number | null
          forgery_risk_score?: number | null
          former_owners_count?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_public?: boolean
          liquidity_score?: number | null
          llm_model?: string | null
          market_signals?: Json
          medium?: string | null
          museum_count?: number | null
          museum_presence_count?: number | null
          narrative?: string | null
          notable_collectors_count?: number | null
          rarity_index?: number | null
          scholarly_citations_count?: number | null
        }
        Update: {
          artist_market_cap_cents?: number | null
          artwork_id?: string
          auction_history_summary?: Json
          condition?: string | null
          confidence_high_cents?: number | null
          confidence_low_cents?: number | null
          cultural_importance_score?: number | null
          engine_version?: string
          estimated_value_cents?: number | null
          exhibition_count?: number | null
          forgery_risk_score?: number | null
          former_owners_count?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_public?: boolean
          liquidity_score?: number | null
          llm_model?: string | null
          market_signals?: Json
          medium?: string | null
          museum_count?: number | null
          museum_presence_count?: number | null
          narrative?: string | null
          notable_collectors_count?: number | null
          rarity_index?: number | null
          scholarly_citations_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_valuations_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_valuations_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_valuations_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      artworks: {
        Row: {
          account_id: string
          artist_account_id: string | null
          artist_name: string | null
          artist_profile_id: string | null
          auction_history: string | null
          celebrity_notes: string | null
          certificate_hash: string | null
          certificate_number: string | null
          certificate_status: string | null
          certificate_type: string | null
          claimed_by_artist_at: string | null
          created_at: string | null
          created_by: string | null
          creation_date: string | null
          description: string | null
          dimensions: string | null
          display_order: number | null
          edition: string | null
          exhibition_history: string | null
          featured: boolean
          featured_at: string | null
          for_sale: boolean
          former_owners: string | null
          gallery_profile_id: string | null
          historic_context: string | null
          id: string
          image_url: string | null
          inquire_enabled: boolean
          is_public: boolean
          is_sold: boolean
          medium: string | null
          metadata: Json | null
          owned_by: string | null
          owned_by_is_public: boolean
          production_location: string | null
          provenance_history: Json | null
          sale_currency: string
          sale_price: number | null
          sold_at: string | null
          sold_by: string | null
          sold_by_account_id: string | null
          sold_by_is_public: boolean
          sold_currency: string | null
          sold_price_cents: number | null
          sold_to_account_id: string | null
          sold_to_email: string | null
          sold_to_name: string | null
          source_artwork_id: string | null
          status: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
          value_is_public: boolean
          verified_by_owner_at: string | null
        }
        Insert: {
          account_id: string
          artist_account_id?: string | null
          artist_name?: string | null
          artist_profile_id?: string | null
          auction_history?: string | null
          celebrity_notes?: string | null
          certificate_hash?: string | null
          certificate_number?: string | null
          certificate_status?: string | null
          certificate_type?: string | null
          claimed_by_artist_at?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_date?: string | null
          description?: string | null
          dimensions?: string | null
          display_order?: number | null
          edition?: string | null
          exhibition_history?: string | null
          featured?: boolean
          featured_at?: string | null
          for_sale?: boolean
          former_owners?: string | null
          gallery_profile_id?: string | null
          historic_context?: string | null
          id?: string
          image_url?: string | null
          inquire_enabled?: boolean
          is_public?: boolean
          is_sold?: boolean
          medium?: string | null
          metadata?: Json | null
          owned_by?: string | null
          owned_by_is_public?: boolean
          production_location?: string | null
          provenance_history?: Json | null
          sale_currency?: string
          sale_price?: number | null
          sold_at?: string | null
          sold_by?: string | null
          sold_by_account_id?: string | null
          sold_by_is_public?: boolean
          sold_currency?: string | null
          sold_price_cents?: number | null
          sold_to_account_id?: string | null
          sold_to_email?: string | null
          sold_to_name?: string | null
          source_artwork_id?: string | null
          status?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
          value_is_public?: boolean
          verified_by_owner_at?: string | null
        }
        Update: {
          account_id?: string
          artist_account_id?: string | null
          artist_name?: string | null
          artist_profile_id?: string | null
          auction_history?: string | null
          celebrity_notes?: string | null
          certificate_hash?: string | null
          certificate_number?: string | null
          certificate_status?: string | null
          certificate_type?: string | null
          claimed_by_artist_at?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_date?: string | null
          description?: string | null
          dimensions?: string | null
          display_order?: number | null
          edition?: string | null
          exhibition_history?: string | null
          featured?: boolean
          featured_at?: string | null
          for_sale?: boolean
          former_owners?: string | null
          gallery_profile_id?: string | null
          historic_context?: string | null
          id?: string
          image_url?: string | null
          inquire_enabled?: boolean
          is_public?: boolean
          is_sold?: boolean
          medium?: string | null
          metadata?: Json | null
          owned_by?: string | null
          owned_by_is_public?: boolean
          production_location?: string | null
          provenance_history?: Json | null
          sale_currency?: string
          sale_price?: number | null
          sold_at?: string | null
          sold_by?: string | null
          sold_by_account_id?: string | null
          sold_by_is_public?: boolean
          sold_currency?: string | null
          sold_price_cents?: number | null
          sold_to_account_id?: string | null
          sold_to_email?: string | null
          sold_to_name?: string | null
          source_artwork_id?: string | null
          status?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
          value_is_public?: boolean
          verified_by_owner_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artworks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_artist_account_id_fkey"
            columns: ["artist_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_gallery_profile_id_fkey"
            columns: ["gallery_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_sold_by_account_id_fkey"
            columns: ["sold_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_sold_to_account_id_fkey"
            columns: ["sold_to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_source_artwork_id_fkey"
            columns: ["source_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_source_artwork_id_fkey"
            columns: ["source_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_events: {
        Row: {
          actor_id: string | null
          asset_id: string
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          planet: string
          signature: string | null
        }
        Insert: {
          actor_id?: string | null
          asset_id: string
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          planet: string
          signature?: string | null
        }
        Update: {
          actor_id?: string | null
          asset_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          planet?: string
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string
          author_user_id: string | null
          body_markdown: string
          canonical_path: string | null
          created_at: string
          description: string | null
          id: string
          og_image_url: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          author_user_id?: string | null
          body_markdown: string
          canonical_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          og_image_url?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_user_id?: string | null
          body_markdown?: string
          canonical_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          og_image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificate_claim_invites: {
        Row: {
          batch_id: string | null
          claim_kind: string
          consumed_at: string | null
          consumed_by: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          invitee_email: string
          provenance_update_request_id: string | null
          result_artwork_id: string | null
          source_artwork_id: string
          status: string
          token_hash: string
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          claim_kind: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          invitee_email: string
          provenance_update_request_id?: string | null
          result_artwork_id?: string | null
          source_artwork_id: string
          status?: string
          token_hash: string
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          claim_kind?: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          invitee_email?: string
          provenance_update_request_id?: string | null
          result_artwork_id?: string | null
          source_artwork_id?: string
          status?: string
          token_hash?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_claim_invites_provenance_update_request_id_fkey"
            columns: ["provenance_update_request_id"]
            isOneToOne: false
            referencedRelation: "provenance_update_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_claim_invites_result_artwork_id_fkey"
            columns: ["result_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_claim_invites_result_artwork_id_fkey"
            columns: ["result_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_claim_invites_source_artwork_id_fkey"
            columns: ["source_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_claim_invites_source_artwork_id_fkey"
            columns: ["source_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          asset_id: string
          certificate_number: string
          id: string
          issued_at: string | null
          issued_by: string | null
          metadata: Json | null
          planet: string
          status: string | null
          verification_score: number | null
          version: number | null
        }
        Insert: {
          asset_id: string
          certificate_number: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json | null
          planet: string
          status?: string | null
          verification_score?: number | null
          version?: number | null
        }
        Update: {
          asset_id?: string
          certificate_number?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json | null
          planet?: string
          status?: string | null
          verification_score?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      collectibles: {
        Row: {
          account_id: string
          category: string | null
          certificate_number: string | null
          certificate_status: string | null
          condition: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          grading_score: string | null
          grading_service: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          is_public: boolean
          manufacturer: string | null
          metadata: Json | null
          provenance_history: Json | null
          serial_number: string | null
          status: string | null
          subcategory: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
          value_is_public: boolean
          year: number | null
        }
        Insert: {
          account_id: string
          category?: string | null
          certificate_number?: string | null
          certificate_status?: string | null
          condition?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grading_score?: string | null
          grading_service?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_public?: boolean
          manufacturer?: string | null
          metadata?: Json | null
          provenance_history?: Json | null
          serial_number?: string | null
          status?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
          value_is_public?: boolean
          year?: number | null
        }
        Update: {
          account_id?: string
          category?: string | null
          certificate_number?: string | null
          certificate_status?: string | null
          condition?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grading_score?: string | null
          grading_service?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_public?: boolean
          manufacturer?: string | null
          metadata?: Json | null
          provenance_history?: Json | null
          serial_number?: string | null
          status?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
          value_is_public?: boolean
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collectibles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_purchases: {
        Row: {
          created_at: string
          domain: string
          error: string | null
          id: string
          price_usd_cents: number | null
          profile_id: string
          status: string
          stripe_checkout_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          error?: string | null
          id?: string
          price_usd_cents?: number | null
          profile_id: string
          status?: string
          stripe_checkout_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          error?: string | null
          id?: string
          price_usd_cents?: number | null
          profile_id?: string
          status?: string
          stripe_checkout_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_purchases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string | null
          id: string
          ink: string
          ink_muted: string
          ink_subtitle: string
          layout_preset: string
          masthead_subtitle: string
          masthead_title: string
          parchment: string
          updated_at: string | null
          wine: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ink?: string
          ink_muted?: string
          ink_subtitle?: string
          layout_preset?: string
          masthead_subtitle?: string
          masthead_title?: string
          parchment?: string
          updated_at?: string | null
          wine?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ink?: string
          ink_muted?: string
          ink_subtitle?: string
          layout_preset?: string
          masthead_subtitle?: string
          masthead_title?: string
          parchment?: string
          updated_at?: string | null
          wine?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_markdown: string
          created_at: string | null
          subject: string
          template_key: string
          updated_at: string | null
        }
        Insert: {
          body_markdown: string
          created_at?: string | null
          subject: string
          template_key: string
          updated_at?: string | null
        }
        Update: {
          body_markdown?: string
          created_at?: string | null
          subject?: string
          template_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      entity_stats: {
        Row: {
          artworks_produced_count: number
          auction_high_cents: number
          auction_low_cents: number
          auction_median_cents: number
          average_sale_cents: number
          entity_account_id: string
          entity_role: string
          exhibition_count: number
          forgery_risk_flag: boolean
          last_sale_at: string | null
          market_cap_cents: number
          museum_exhibition_count: number
          rarity_index: number
          represented_artwork_count: number
          scholarly_citations_count: number
          stale_at: string | null
          total_sales_cents: number
          total_sales_count: number
          updated_at: string
        }
        Insert: {
          artworks_produced_count?: number
          auction_high_cents?: number
          auction_low_cents?: number
          auction_median_cents?: number
          average_sale_cents?: number
          entity_account_id: string
          entity_role: string
          exhibition_count?: number
          forgery_risk_flag?: boolean
          last_sale_at?: string | null
          market_cap_cents?: number
          museum_exhibition_count?: number
          rarity_index?: number
          represented_artwork_count?: number
          scholarly_citations_count?: number
          stale_at?: string | null
          total_sales_cents?: number
          total_sales_count?: number
          updated_at?: string
        }
        Update: {
          artworks_produced_count?: number
          auction_high_cents?: number
          auction_low_cents?: number
          auction_median_cents?: number
          average_sale_cents?: number
          entity_account_id?: string
          entity_role?: string
          exhibition_count?: number
          forgery_risk_flag?: boolean
          last_sale_at?: string | null
          market_cap_cents?: number
          museum_exhibition_count?: number
          rarity_index?: number
          represented_artwork_count?: number
          scholarly_citations_count?: number
          stale_at?: string | null
          total_sales_cents?: number
          total_sales_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_stats_entity_account_id_fkey"
            columns: ["entity_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_artist_invites: {
        Row: {
          artist_account_id: string | null
          consumed_at: string | null
          consumed_by: string | null
          created_at: string | null
          created_by: string | null
          exhibition_id: string
          expires_at: string
          id: string
          invitee_email: string
          invitee_name: string | null
          result_artwork_id: string | null
          result_cos_artwork_id: string | null
          status: string
          token_hash: string
          updated_at: string | null
        }
        Insert: {
          artist_account_id?: string | null
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          exhibition_id: string
          expires_at: string
          id?: string
          invitee_email: string
          invitee_name?: string | null
          result_artwork_id?: string | null
          result_cos_artwork_id?: string | null
          status?: string
          token_hash: string
          updated_at?: string | null
        }
        Update: {
          artist_account_id?: string | null
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          exhibition_id?: string
          expires_at?: string
          id?: string
          invitee_email?: string
          invitee_name?: string | null
          result_artwork_id?: string | null
          result_cos_artwork_id?: string | null
          status?: string
          token_hash?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_artist_invites_artist_account_id_fkey"
            columns: ["artist_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artist_invites_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artist_invites_result_artwork_id_fkey"
            columns: ["result_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artist_invites_result_artwork_id_fkey"
            columns: ["result_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artist_invites_result_cos_artwork_id_fkey"
            columns: ["result_cos_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artist_invites_result_cos_artwork_id_fkey"
            columns: ["result_cos_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_artists: {
        Row: {
          artist_account_id: string
          created_at: string
          exhibition_id: string
          id: string
        }
        Insert: {
          artist_account_id: string
          created_at?: string
          exhibition_id: string
          id?: string
        }
        Update: {
          artist_account_id?: string
          created_at?: string
          exhibition_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_artists_artist_account_id_fkey"
            columns: ["artist_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artists_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_artworks: {
        Row: {
          artwork_id: string
          created_at: string
          exhibition_id: string
          id: string
        }
        Insert: {
          artwork_id: string
          created_at?: string
          exhibition_id: string
          id?: string
        }
        Update: {
          artwork_id?: string
          created_at?: string
          exhibition_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_artworks_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artworks_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artworks_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_memories: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          body: string | null
          created_at: string
          exhibition_id: string
          id: string
          image_urls: string[]
          user_id: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          exhibition_id: string
          id?: string
          image_urls?: string[]
          user_id: string
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          exhibition_id?: string
          id?: string
          image_urls?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_memories_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_object_plans: {
        Row: {
          account_id: string
          alert_sent_at: string | null
          artwork_id: string
          created_at: string
          curator_email: string | null
          curator_name: string | null
          curator_user_id: string | null
          deinstall_date: string | null
          document_storage_path: string | null
          exhibition_id: string | null
          exhibition_title: string | null
          id: string
          install_date: string | null
          lender_email: string | null
          lender_name: string | null
          lender_user_id: string | null
          notes: string | null
          object_label: string | null
          status: string
          updated_at: string
          venue_location: string | null
          venue_name: string | null
        }
        Insert: {
          account_id: string
          alert_sent_at?: string | null
          artwork_id: string
          created_at?: string
          curator_email?: string | null
          curator_name?: string | null
          curator_user_id?: string | null
          deinstall_date?: string | null
          document_storage_path?: string | null
          exhibition_id?: string | null
          exhibition_title?: string | null
          id?: string
          install_date?: string | null
          lender_email?: string | null
          lender_name?: string | null
          lender_user_id?: string | null
          notes?: string | null
          object_label?: string | null
          status?: string
          updated_at?: string
          venue_location?: string | null
          venue_name?: string | null
        }
        Update: {
          account_id?: string
          alert_sent_at?: string | null
          artwork_id?: string
          created_at?: string
          curator_email?: string | null
          curator_name?: string | null
          curator_user_id?: string | null
          deinstall_date?: string | null
          document_storage_path?: string | null
          exhibition_id?: string | null
          exhibition_title?: string | null
          id?: string
          install_date?: string | null
          lender_email?: string | null
          lender_name?: string | null
          lender_user_id?: string | null
          notes?: string | null
          object_label?: string | null
          status?: string
          updated_at?: string
          venue_location?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_object_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_object_plans_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_object_plans_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_object_plans_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibitions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          gallery_id: string
          id: string
          image_url: string | null
          location: string | null
          metadata: Json | null
          owner_role: string
          published_at: string | null
          start_date: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          gallery_id: string
          id?: string
          image_url?: string | null
          location?: string | null
          metadata?: Json | null
          owner_role?: string
          published_at?: string | null
          start_date: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          gallery_id?: string
          id?: string
          image_url?: string | null
          location?: string | null
          metadata?: Json | null
          owner_role?: string
          published_at?: string | null
          start_date?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibitions_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_tickets: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          is_anonymous: boolean
          message: string
          page_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string | null
          submitted_by: string | null
          submitter_email: string | null
          submitter_name: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          message: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string | null
          submitted_by?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          message?: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string | null
          submitted_by?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      gallery_members: {
        Row: {
          created_at: string
          gallery_profile_id: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gallery_profile_id: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gallery_profile_id?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_members_gallery_profile_id_fkey"
            columns: ["gallery_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_proposals: {
        Row: {
          artist_profile_id: string | null
          content_json: Json | null
          content_text: string | null
          created_at: string
          grant_id: string | null
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_profile_id?: string | null
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          grant_id?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_profile_id?: string | null
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          grant_id?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_proposals_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_proposals_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "artist_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_reports: {
        Row: {
          created_at: string
          grant_id: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grant_id: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          grant_id?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_reports_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "artist_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_upvotes: {
        Row: {
          created_at: string
          grant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          grant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_upvotes_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "artist_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_valuations: {
        Row: {
          account_id: string
          alert_sent_at: string | null
          appraisal_date: string | null
          appraiser_email: string | null
          appraiser_name: string | null
          appraiser_user_id: string | null
          artwork_id: string
          coverage_amount_cents: number | null
          created_at: string
          currency: string
          document_storage_path: string | null
          id: string
          insurer_contact_email: string | null
          insurer_name: string
          insurer_user_id: string | null
          policy_end_date: string | null
          policy_number: string | null
          policy_start_date: string | null
          status: string
          updated_at: string
          valuation_notes: string | null
        }
        Insert: {
          account_id: string
          alert_sent_at?: string | null
          appraisal_date?: string | null
          appraiser_email?: string | null
          appraiser_name?: string | null
          appraiser_user_id?: string | null
          artwork_id: string
          coverage_amount_cents?: number | null
          created_at?: string
          currency?: string
          document_storage_path?: string | null
          id?: string
          insurer_contact_email?: string | null
          insurer_name?: string
          insurer_user_id?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          status?: string
          updated_at?: string
          valuation_notes?: string | null
        }
        Update: {
          account_id?: string
          alert_sent_at?: string | null
          appraisal_date?: string | null
          appraiser_email?: string | null
          appraiser_name?: string | null
          appraiser_user_id?: string | null
          artwork_id?: string
          coverage_amount_cents?: number | null
          created_at?: string
          currency?: string
          document_storage_path?: string | null
          id?: string
          insurer_contact_email?: string | null
          insurer_name?: string
          insurer_user_id?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          status?: string
          updated_at?: string
          valuation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_valuations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_valuations_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_valuations_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          unit_amount_cents: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          unit_amount_cents: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          unit_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          artwork_id: string | null
          client_email: string | null
          client_name: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          sent_at: string | null
          status: string
          tax_cents: number
          updated_at: string
        }
        Insert: {
          account_id: string
          artwork_id?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          tax_cents?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          artwork_id?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          tax_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          source: string
          source_title: string | null
          source_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source?: string
          source_title?: string | null
          source_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source?: string
          source_title?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          artwork_id: string | null
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          read: boolean
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          artwork_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          artwork_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      open_call_submissions: {
        Row: {
          account_id: string | null
          artist_email: string
          artist_name: string
          artworks: Json | null
          created_at: string
          id: string
          message: string | null
          open_call_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          artist_email: string
          artist_name: string
          artworks?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          open_call_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          artist_email?: string
          artist_name?: string
          artworks?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          open_call_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_call_submissions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_call_submissions_open_call_id_fkey"
            columns: ["open_call_id"]
            isOneToOne: false
            referencedRelation: "open_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      open_calls: {
        Row: {
          call_type: string | null
          created_at: string
          created_by: string | null
          eligible_locations: string[] | null
          exhibition_id: string
          external_url: string | null
          gallery_profile_id: string
          id: string
          medium: string | null
          slug: string
          submission_closing_date: string | null
          submission_open_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          call_type?: string | null
          created_at?: string
          created_by?: string | null
          eligible_locations?: string[] | null
          exhibition_id: string
          external_url?: string | null
          gallery_profile_id: string
          id?: string
          medium?: string | null
          slug: string
          submission_closing_date?: string | null
          submission_open_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          call_type?: string | null
          created_at?: string
          created_by?: string | null
          eligible_locations?: string[] | null
          exhibition_id?: string
          external_url?: string | null
          gallery_profile_id?: string
          id?: string
          medium?: string | null
          slug?: string
          submission_closing_date?: string | null
          submission_open_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "open_calls_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_calls_gallery_profile_id_fkey"
            columns: ["gallery_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_activity: {
        Row: {
          last_seen_at: string
          path: string
          total_active_minutes: number
          view_count: number
        }
        Insert: {
          last_seen_at?: string
          path: string
          total_active_minutes?: number
          view_count?: number
        }
        Update: {
          last_seen_at?: string
          path?: string
          total_active_minutes?: number
          view_count?: number
        }
        Relationships: []
      }
      pitch_deck_content: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profile_sites: {
        Row: {
          about_override: string | null
          artwork_filters: Json
          created_at: string
          cta: Json | null
          custom_domain: string | null
          custom_domain_verified_at: string | null
          display_name: string | null
          featured_artwork_ids: Json
          handle: string
          hero_image_url: string | null
          logo_image_url: string | null
          profile_id: string
          published_at: string | null
          sections: Json
          surface_color: string | null
          tagline: string | null
          template_id: string
          theme: Json
          updated_at: string
        }
        Insert: {
          about_override?: string | null
          artwork_filters?: Json
          created_at?: string
          cta?: Json | null
          custom_domain?: string | null
          custom_domain_verified_at?: string | null
          display_name?: string | null
          featured_artwork_ids?: Json
          handle: string
          hero_image_url?: string | null
          logo_image_url?: string | null
          profile_id: string
          published_at?: string | null
          sections?: Json
          surface_color?: string | null
          tagline?: string | null
          template_id?: string
          theme?: Json
          updated_at?: string
        }
        Update: {
          about_override?: string | null
          artwork_filters?: Json
          created_at?: string
          cta?: Json | null
          custom_domain?: string | null
          custom_domain_verified_at?: string | null
          display_name?: string | null
          featured_artwork_ids?: Json
          handle?: string
          hero_image_url?: string | null
          logo_image_url?: string | null
          profile_id?: string
          published_at?: string | null
          sections?: Json
          surface_color?: string | null
          tagline?: string | null
          template_id?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_sites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          account_id: string
          address: string | null
          building_size: string | null
          certificate_number: string | null
          certificate_status: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          deed_type: string | null
          description: string | null
          id: string
          image_url: string | null
          is_public: boolean
          lot_size: string | null
          metadata: Json | null
          parcel_number: string | null
          property_type: string | null
          provenance_history: Json | null
          state: string | null
          status: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          year_built: number | null
          zip: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          building_size?: string | null
          certificate_number?: string | null
          certificate_status?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          deed_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          lot_size?: string | null
          metadata?: Json | null
          parcel_number?: string | null
          property_type?: string | null
          provenance_history?: Json | null
          state?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          building_size?: string | null
          certificate_number?: string | null
          certificate_status?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          deed_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          lot_size?: string | null
          metadata?: Json | null
          parcel_number?: string | null
          property_type?: string | null
          provenance_history?: Json | null
          state?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          year_built?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      provenance_events: {
        Row: {
          actor_account_id: string | null
          actor_name: string | null
          artwork_id: string
          event_date: string
          event_type: string
          id: string
          metadata: Json
          related_artwork_id: string | null
        }
        Insert: {
          actor_account_id?: string | null
          actor_name?: string | null
          artwork_id: string
          event_date?: string
          event_type: string
          id?: string
          metadata?: Json
          related_artwork_id?: string | null
        }
        Update: {
          actor_account_id?: string | null
          actor_name?: string | null
          artwork_id?: string
          event_date?: string
          event_type?: string
          id?: string
          metadata?: Json
          related_artwork_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provenance_events_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_events_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_events_related_artwork_id_fkey"
            columns: ["related_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_events_related_artwork_id_fkey"
            columns: ["related_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      provenance_update_requests: {
        Row: {
          artwork_id: string
          created_at: string | null
          id: string
          request_message: string | null
          request_type: string
          requested_at: string | null
          requested_by: string
          review_message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          update_fields: Json
          updated_at: string | null
        }
        Insert: {
          artwork_id: string
          created_at?: string | null
          id?: string
          request_message?: string | null
          request_type?: string
          requested_at?: string | null
          requested_by: string
          review_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          update_fields?: Json
          updated_at?: string | null
        }
        Update: {
          artwork_id?: string
          created_at?: string | null
          id?: string
          request_message?: string | null
          request_type?: string
          requested_at?: string | null
          requested_by?: string
          review_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          update_fields?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provenance_update_requests_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_update_requests_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_ledger: {
        Row: {
          artwork_id: string
          created_at: string
          currency: string
          id: string
          metadata: Json
          notes: string | null
          price_cents: number | null
          recorded_by: string | null
          sold_at: string
          sold_by_account_id: string | null
          sold_to_account_id: string | null
          sold_to_email: string | null
          sold_to_name: string | null
        }
        Insert: {
          artwork_id: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          notes?: string | null
          price_cents?: number | null
          recorded_by?: string | null
          sold_at?: string
          sold_by_account_id?: string | null
          sold_to_account_id?: string | null
          sold_to_email?: string | null
          sold_to_name?: string | null
        }
        Update: {
          artwork_id?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          notes?: string | null
          price_cents?: number | null
          recorded_by?: string | null
          sold_at?: string
          sold_by_account_id?: string | null
          sold_to_account_id?: string | null
          sold_to_email?: string | null
          sold_to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_ledger_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_ledger_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_ledger_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_ledger_sold_by_account_id_fkey"
            columns: ["sold_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_ledger_sold_to_account_id_fkey"
            columns: ["sold_to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          payouts_enabled?: boolean
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_customers: {
        Row: {
          created_at: string
          stripe_customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          stripe_customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          stripe_customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          role: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          role: string
          status: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          role?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      taco_unhandled_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          pathname: string | null
          resolved: boolean
          taco_summary: string
          user_id: string
          user_message: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          pathname?: string | null
          resolved?: boolean
          taco_summary: string
          user_id: string
          user_message: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          pathname?: string | null
          resolved?: boolean
          taco_summary?: string
          user_id?: string
          user_message?: string
        }
        Relationships: []
      }
      taco_usage_logs: {
        Row: {
          agent_iterations: number
          completion_tokens: number
          created_at: string
          estimated_cost_usd: number
          had_docs: boolean
          had_images: boolean
          id: string
          prompt_tokens: number
          total_tokens: number
          user_id: string
        }
        Insert: {
          agent_iterations?: number
          completion_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          had_docs?: boolean
          had_images?: boolean
          id?: string
          prompt_tokens?: number
          total_tokens?: number
          user_id: string
        }
        Update: {
          agent_iterations?: number
          completion_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          had_docs?: boolean
          had_images?: boolean
          id?: string
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      user_activity_daily: {
        Row: {
          active_minutes: number
          day: string
          user_id: string
        }
        Insert: {
          active_minutes?: number
          day: string
          user_id: string
        }
        Update: {
          active_minutes?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_type: string
          description: string | null
          emoji: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_type: string
          description?: string | null
          emoji?: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_type?: string
          description?: string | null
          emoji?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      user_daily_commits: {
        Row: {
          breakdown: Json
          commit_count: number
          commit_date: string
          created_at: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          commit_count?: number
          commit_date: string
          created_at?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          commit_count?: number
          commit_date?: string
          created_at?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          created_at: string
          current_streak_days: number
          daily_favorite_count: number
          daily_favorite_date: string | null
          daily_upload_count: number
          daily_upload_date: string | null
          emoji: string
          has_daily_favorite_bonus: boolean
          has_daily_upload_bonus: boolean
          id: string
          is_archived: boolean
          is_default: boolean
          last_checkin_date: string | null
          longest_streak_days: number
          star_tier: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak_days?: number
          daily_favorite_count?: number
          daily_favorite_date?: string | null
          daily_upload_count?: number
          daily_upload_date?: string | null
          emoji?: string
          has_daily_favorite_bonus?: boolean
          has_daily_upload_bonus?: boolean
          id?: string
          is_archived?: boolean
          is_default?: boolean
          last_checkin_date?: string | null
          longest_streak_days?: number
          star_tier?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak_days?: number
          daily_favorite_count?: number
          daily_favorite_date?: string | null
          daily_upload_count?: number
          daily_upload_date?: string | null
          emoji?: string
          has_daily_favorite_bonus?: boolean
          has_daily_upload_bonus?: boolean
          id?: string
          is_archived?: boolean
          is_default?: boolean
          last_checkin_date?: string | null
          longest_streak_days?: number
          star_tier?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          last_incremented_at: string | null
          last_seen_at: string
          total_active_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_incremented_at?: string | null
          last_seen_at?: string
          total_active_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_incremented_at?: string | null
          last_seen_at?: string
          total_active_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active_planets: Json | null
          artist_cv_file_path: string | null
          artist_cv_file_url: string | null
          artist_cv_json: Json | null
          artist_cv_uploaded_at: string | null
          bio: string | null
          claimed_at: string | null
          contact_email: string | null
          created_at: string
          created_by_gallery_id: string | null
          established_year: number | null
          feed_panel_artwork_ids: string[] | null
          galleries: string[] | null
          has_sold_work: string | null
          id: string
          is_active: boolean
          is_claimed: boolean
          links: string[] | null
          location: string | null
          medium: string | null
          name: string
          news_publications: Json
          onboarding_answers: Json | null
          onboarding_completed_at: string | null
          phone: string | null
          picture_url: string | null
          registry_artwork_id: string | null
          registry_artwork_ids: string[] | null
          role: string
          slug: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          active_planets?: Json | null
          artist_cv_file_path?: string | null
          artist_cv_file_url?: string | null
          artist_cv_json?: Json | null
          artist_cv_uploaded_at?: string | null
          bio?: string | null
          claimed_at?: string | null
          contact_email?: string | null
          created_at?: string
          created_by_gallery_id?: string | null
          established_year?: number | null
          feed_panel_artwork_ids?: string[] | null
          galleries?: string[] | null
          has_sold_work?: string | null
          id?: string
          is_active?: boolean
          is_claimed?: boolean
          links?: string[] | null
          location?: string | null
          medium?: string | null
          name: string
          news_publications?: Json
          onboarding_answers?: Json | null
          onboarding_completed_at?: string | null
          phone?: string | null
          picture_url?: string | null
          registry_artwork_id?: string | null
          registry_artwork_ids?: string[] | null
          role: string
          slug?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          active_planets?: Json | null
          artist_cv_file_path?: string | null
          artist_cv_file_url?: string | null
          artist_cv_json?: Json | null
          artist_cv_uploaded_at?: string | null
          bio?: string | null
          claimed_at?: string | null
          contact_email?: string | null
          created_at?: string
          created_by_gallery_id?: string | null
          established_year?: number | null
          feed_panel_artwork_ids?: string[] | null
          galleries?: string[] | null
          has_sold_work?: string | null
          id?: string
          is_active?: boolean
          is_claimed?: boolean
          links?: string[] | null
          location?: string | null
          medium?: string | null
          name?: string
          news_publications?: Json
          onboarding_answers?: Json | null
          onboarding_completed_at?: string | null
          phone?: string | null
          picture_url?: string | null
          registry_artwork_id?: string | null
          registry_artwork_ids?: string[] | null
          role?: string
          slug?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_created_by_gallery_id_fkey"
            columns: ["created_by_gallery_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_registry_artwork_id_fkey"
            columns: ["registry_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_registry_artwork_id_fkey"
            columns: ["registry_artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_with_favorites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          device: string | null
          ended_at: string
          id: number
          started_at: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          device?: string | null
          ended_at?: string
          id?: never
          started_at?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          device?: string | null
          ended_at?: string
          id?: never
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak_days: number
          daily_favorite_count: number
          daily_favorite_date: string | null
          daily_upload_count: number
          daily_upload_date: string | null
          has_daily_favorite_bonus: boolean
          has_daily_upload_bonus: boolean
          last_active_date: string | null
          longest_streak_days: number
          star_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak_days?: number
          daily_favorite_count?: number
          daily_favorite_date?: string | null
          daily_upload_count?: number
          daily_upload_date?: string | null
          has_daily_favorite_bonus?: boolean
          has_daily_upload_bonus?: boolean
          last_active_date?: string | null
          longest_streak_days?: number
          star_tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak_days?: number
          daily_favorite_count?: number
          daily_favorite_date?: string | null
          daily_upload_count?: number
          daily_upload_date?: string | null
          has_daily_favorite_bonus?: boolean
          has_daily_upload_bonus?: boolean
          last_active_date?: string | null
          longest_streak_days?: number
          star_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          account_id: string
          certificate_number: string | null
          certificate_status: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          engine: string | null
          id: string
          image_url: string | null
          is_public: boolean
          make: string | null
          metadata: Json | null
          mileage: number | null
          model: string | null
          provenance_history: Json | null
          status: string | null
          title: string
          title_number: string | null
          title_state: string | null
          transmission: string | null
          updated_at: string | null
          updated_by: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          account_id: string
          certificate_number?: string | null
          certificate_status?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          engine?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          make?: string | null
          metadata?: Json | null
          mileage?: number | null
          model?: string | null
          provenance_history?: Json | null
          status?: string | null
          title: string
          title_number?: string | null
          title_state?: string | null
          transmission?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          account_id?: string
          certificate_number?: string | null
          certificate_status?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          engine?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          make?: string | null
          metadata?: Json | null
          mileage?: number | null
          model?: string | null
          provenance_history?: Json | null
          status?: string | null
          title?: string
          title_number?: string | null
          title_state?: string | null
          transmission?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          account_id: string
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_user_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          service_type: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_user_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          service_type?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_user_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          service_type?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      artworks_with_favorites: {
        Row: {
          account_id: string | null
          artist_account_id: string | null
          artist_name: string | null
          artist_profile_id: string | null
          certificate_number: string | null
          created_at: string | null
          favorites_count: number | null
          id: string | null
          image_url: string | null
          is_public: boolean | null
          medium: string | null
          status: string | null
          title: string | null
          trending_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "artworks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_artist_account_id_fkey"
            columns: ["artist_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_dau_series: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          day: string
        }[]
      }
      admin_device_breakdown: {
        Args: never
        Returns: {
          browser: string
          cnt: number
          device: string
        }[]
      }
      admin_retention: {
        Args: never
        Returns: {
          new_users: number
          retention_pct: number
          returning_users: number
          week_start: string
        }[]
      }
      admin_session_stats: {
        Args: never
        Returns: {
          avg_session_minutes: number
          distinct_users: number
          median_session_minutes: number
          p90_session_minutes: number
          total_sessions: number
        }[]
      }
      admin_top_artwork_uploaders: {
        Args: { p_limit?: number }
        Returns: {
          upload_count: number
          user_id: string
        }[]
      }
      admin_top_pages: {
        Args: { p_limit?: number }
        Returns: {
          last_seen_at: string
          path: string
          total_active_minutes: number
          view_count: number
        }[]
      }
      generate_certificate_number: { Args: never; Returns: string }
      generate_collectible_certificate_number: { Args: never; Returns: string }
      generate_unique_gallery_slug: {
        Args: { base_name: string }
        Returns: string
      }
      get_unread_notification_count: {
        Args: { user_uuid: string }
        Returns: number
      }
      get_user_id_by_email_for_notifications: {
        Args: { p_email: string }
        Returns: string
      }
      is_gallery_member_for_artwork: {
        Args: { artwork_account_id: string; artwork_gallery_profile_id: string }
        Returns: boolean
      }
      is_gallery_member_for_exhibition: {
        Args: { exhibition_gallery_id: string }
        Returns: boolean
      }
      is_gallery_owner_or_admin: {
        Args: { p_gallery_profile_id: string }
        Returns: boolean
      }
      match_knowledge_chunks: {
        Args: {
          filter_source?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          source: string
          source_title: string
          source_url: string
        }[]
      }
      record_user_heartbeat: {
        Args: {
          p_browser?: string
          p_device?: string
          p_path?: string
          p_user_id: string
        }
        Returns: {
          last_seen_at: string
          total_active_minutes: number
        }[]
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
