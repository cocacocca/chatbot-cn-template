// 此文件由 supabase gen types 生成，请勿手动修改
// 生成命令：docker exec supabase-db psql -U postgres -d postgres -c "..." (或 supabase gen types)
// 最后更新：2026-06-17

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      cct_user_profile: {
        Row: {
          id: string;
          name: string | null;
          image: string | null;
          is_anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          image?: string | null;
          is_anonymous?: boolean;
        };
        Update: {
          name?: string | null;
          image?: string | null;
          is_anonymous?: boolean;
        };
        Relationships: [];
      };
      cct_chat: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
        };
        Update: {
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cct_chat_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cct_message: {
        Row: {
          id: string;
          chat_id: string;
          role: string;
          parts: Json | null;
          attachments: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          role: string;
          parts?: Json | null;
          attachments?: Json | null;
          created_at?: string;
        };
        Update: {
          parts?: Json | null;
          attachments?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "cct_message_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "cct_chat";
            referencedColumns: ["id"];
          },
        ];
      };
      cct_document: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          content: string | null;
          kind: "text" | "code" | "image" | "sheet";
          title: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          user_id: string;
          content?: string | null;
          kind: "text" | "code" | "image" | "sheet";
          title?: string | null;
        };
        Update: {
          content?: string | null;
          kind?: "text" | "code" | "image" | "sheet";
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cct_document_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cct_suggestion: {
        Row: {
          id: string;
          document_id: string;
          document_created_at: string;
          user_id: string;
          original_text: string | null;
          suggested_text: string | null;
          is_resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          document_created_at: string;
          user_id: string;
          original_text?: string | null;
          suggested_text?: string | null;
          is_resolved?: boolean;
        };
        Update: {
          original_text?: string | null;
          suggested_text?: string | null;
          is_resolved?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "cct_suggestion_document_id_document_created_at_fkey";
            columns: ["document_id", "document_created_at"];
            isOneToOne: false;
            referencedRelation: "cct_document";
            referencedColumns: ["id", "created_at"];
          },
          {
            foreignKeyName: "cct_suggestion_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cct_model_config: {
        Row: {
          id: string;
          provider: string;
          base_url: string | null;
          api_key: string | null;
          capabilities: Json | null;
          reasoning_effort: string | null;
          is_default: boolean;
          is_title_model: boolean;
          created_at: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          id: string;
          provider: string;
          base_url?: string | null;
          api_key?: string | null;
          capabilities?: Json | null;
          reasoning_effort?: string | null;
          is_default?: boolean;
          is_title_model?: boolean;
          user_id?: string | null;
        };
        Update: {
          provider?: string;
          base_url?: string | null;
          api_key?: string | null;
          capabilities?: Json | null;
          reasoning_effort?: string | null;
          is_default?: boolean;
          is_title_model?: boolean;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cct_model_config_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      cct_document_latest: {
        Row: {
          id: string | null;
          created_at: string | null;
          user_id: string | null;
          content: string | null;
          kind: "text" | "code" | "image" | "sheet" | null;
          title: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      cct_get_message_count_by_user_id: {
        Args: {
          since?: string;
        };
        Returns: number;
      };
    };
  };
};
