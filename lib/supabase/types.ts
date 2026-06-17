// 此文件由 supabase gen types 生成，首次运行后替换
export type Database = {
  public: {
    Tables: {
      user_profile: {
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
      chat: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          visibility: "public" | "private";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          visibility?: "public" | "private";
        };
        Update: {
          title?: string | null;
          visibility?: "public" | "private";
        };
        Relationships: [];
      };
      message: {
        Row: {
          id: string;
          chat_id: string;
          role: string;
          parts: unknown;
          attachments: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          role: string;
          parts?: unknown;
          attachments?: unknown;
          created_at?: string;
        };
        Update: {
          parts?: unknown;
          attachments?: unknown;
        };
        Relationships: [];
      };
      vote: {
        Row: {
          chat_id: string;
          message_id: string;
          is_upvoted: boolean;
        };
        Insert: {
          chat_id: string;
          message_id: string;
          is_upvoted: boolean;
        };
        Update: {
          is_upvoted?: boolean;
        };
        Relationships: [];
      };
      document: {
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
        Relationships: [];
      };
      suggestion: {
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
        Relationships: [];
      };
      model_config: {
        Row: {
          id: string;
          provider: string;
          base_url: string | null;
          api_key: string | null;
          capabilities: unknown;
          reasoning_effort: string | null;
          is_default: boolean;
          is_title_model: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          provider: string;
          base_url?: string | null;
          api_key?: string | null;
          capabilities?: unknown;
          reasoning_effort?: string | null;
          is_default?: boolean;
          is_title_model?: boolean;
        };
        Update: {
          provider?: string;
          base_url?: string | null;
          api_key?: string | null;
          capabilities?: unknown;
          reasoning_effort?: string | null;
          is_default?: boolean;
          is_title_model?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      document_latest: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          content: string | null;
          kind: "text" | "code" | "image" | "sheet";
          title: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_message_count_by_user_id: {
        Args: {
          since?: string;
        };
        Returns: number;
      };
    };
  };
};
