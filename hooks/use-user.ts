"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { UserProfile } from "@/lib/queries/client/types";
import { getProfile } from "@/lib/queries/client/user-queries";
import { createClient } from "@/lib/supabase/client";

export function useUser() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      setUser(user);
      setLoading(false);

      if (user) {
        const profileData = await getProfile();
        if (mounted) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { user, profile, loading };
}
