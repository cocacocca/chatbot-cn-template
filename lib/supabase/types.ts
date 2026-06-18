/**
 * @file Supabase 数据库类型定义（自动生成）
 *
 * 此文件由 `supabase gen types` 生成，请勿手动修改类型定义。
 * 生成命令：docker exec supabase-db psql -U postgres -d postgres -c "..." (或 supabase gen types)
 * 最后更新：2026-06-17
 *
 * 包含 `public` schema 下的：
 * - 表（Tables）：cct_user_profile / cct_chat / cct_message / cct_document / cct_suggestion / cct_model_config
 * - 视图（Views）：cct_document_latest
 * - 函数（Functions）：cct_get_message_count_by_user_id
 *
 * 注：仅注释为人工补充，类型定义本身为自动生成。
 */

/** JSON 递归类型，对应 PostgreSQL 的 json/jsonb */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Supabase 数据库类型映射
 *
 * 描述 `public` schema 下所有表、视图、函数的类型结构，
 * 供 `createClient<Database>` 使用以提供类型安全的数据库访问。
 */
export type Database = {
  public: {
    Tables: {
      /**
       * 用户档案表
       *
       * 存储用户的展示信息，与 `auth.users` 一对一关联。
       * 支持匿名用户（`is_anonymous = true`）。
       * RLS 策略：用户仅能读写自己的档案。
       */
      cct_user_profile: {
        Row: {
          id: string; // 用户 ID，对应 auth.users.id
          name: string | null; // 展示名称
          image: string | null; // 头像 URL
          is_anonymous: boolean; // 是否为匿名用户
          created_at: string; // 创建时间（ISO 字符串）
          updated_at: string; // 更新时间（ISO 字符串）
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
      /**
       * 聊天会话表
       *
       * 记录每个聊天会话的元信息，属于某个用户。
       * 与 `cct_message` 一对多关联（一个会话包含多条消息）。
       * RLS 策略：用户仅能读写自己的会话。
       */
      cct_chat: {
        Row: {
          id: string; // 会话 ID（UUID）
          user_id: string; // 所属用户 ID，外键关联 auth.users.id
          title: string | null; // 会话标题（通常由首条消息或标题模型生成）
          created_at: string; // 创建时间（ISO 字符串）
        };
        Insert: {
          id?: string; // 未提供时由数据库生成
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
      /**
       * 聊天消息表
       *
       * 存储会话中的每一条消息（用户消息或 AI 回复）。
       * `parts` 字段使用 JSON 存储结构化的消息内容（文本、工具调用等）。
       * `attachments` 字段使用 JSON 存储附件元信息（路径、类型等）。
       * RLS 策略：用户仅能读写自己会话中的消息。
       */
      cct_message: {
        Row: {
          id: string; // 消息 ID（UUID）
          chat_id: string; // 所属会话 ID，外键关联 cct_chat.id
          role: string; // 消息角色：user / assistant / system 等
          parts: Json | null; // 消息内容片段（JSON 数组，支持文本、工具调用等）
          attachments: Json | null; // 附件元信息（JSON 数组，含路径、类型等）
          created_at: string; // 创建时间（ISO 字符串）
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
      /**
       * 文档表
       *
       * 存储用户创建的文档（文本、代码、图片、表格）。
       * 与 `cct_suggestion` 一对多关联（一个文档可有多条建议）。
       * RLS 策略：用户仅能读写自己的文档。
       */
      cct_document: {
        Row: {
          id: string; // 文档 ID（UUID）
          created_at: string; // 创建时间（ISO 字符串，作为复合主键的一部分）
          user_id: string; // 所属用户 ID，外键关联 auth.users.id
          content: string | null; // 文档内容（文本/代码内容或图片 URL）
          kind: "text" | "code" | "image" | "sheet"; // 文档类型
          title: string | null; // 文档标题
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
      /**
       * 文档建议表
       *
       * 存储针对文档某段原文的修改建议（如 AI 生成的内容优化建议）。
       * 通过 `(document_id, document_created_at)` 复合外键关联到 `cct_document`。
       * `is_resolved` 标记建议是否已被处理（接受或拒绝）。
       * RLS 策略：用户仅能读写自己文档的建议。
       */
      cct_suggestion: {
        Row: {
          id: string; // 建议 ID（UUID）
          document_id: string; // 关联文档 ID（复合外键之一）
          document_created_at: string; // 关联文档创建时间（复合外键之一）
          user_id: string; // 所属用户 ID，外键关联 auth.users.id
          original_text: string | null; // 原始文本片段
          suggested_text: string | null; // 建议替换的文本
          is_resolved: boolean; // 是否已处理（接受/拒绝）
          created_at: string; // 创建时间（ISO 字符串）
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
      /**
       * 模型配置表
       *
       * 存储用户自定义的 AI 模型配置（provider、API key、能力等）。
       * `is_default` 标记是否为默认模型，`is_title_model` 标记是否用于生成会话标题。
       * `user_id` 为 null 时表示全局配置（系统级默认）。
       * RLS 策略：用户仅能读写自己的配置，全局配置仅管理员可写。
       */
      cct_model_config: {
        Row: {
          id: string; // 配置 ID（UUID）
          provider: string; // 模型提供商（如 openai / anthropic / google）
          base_url: string | null; // 自定义 API 基础 URL（用于代理或自托管）
          api_key: string | null; // API 密钥（加密存储）
          capabilities: Json | null; // 模型能力描述（JSON，如支持流式、工具调用等）
          reasoning_effort: string | null; // 推理强度（如 low/medium/high，适用于推理模型）
          is_default: boolean; // 是否为用户的默认模型
          is_title_model: boolean; // 是否用于生成会话标题
          created_at: string; // 创建时间（ISO 字符串）
          updated_at: string; // 更新时间（ISO 字符串）
          user_id: string | null; // 所属用户 ID，null 表示全局配置
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
      /**
       * 文档最新版本视图
       *
       * 返回每个文档的最新版本（按 `created_at` 降序取首条）。
       * 用于在文档列表中展示每个文档的最新内容，避免多次查询。
       * 字段均为可空（视图可能返回 NULL）。
       */
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
      /**
       * 获取当前用户消息数量的 RPC 函数
       *
       * 基于 `auth.uid()` 获取当前登录用户 ID，
       * 统计该用户在 `cct_message` 表中的消息数量。
       *
       * @param since - 可选参数，仅统计该时间点之后的消息
       * @returns 消息数量
       */
      cct_get_message_count_by_user_id: {
        Args: {
          since?: string;
        };
        Returns: number;
      };
    };
  };
};
