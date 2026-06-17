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
      };
    };
  };
};
