"use client";

import type { SWRConfiguration } from "swr";
import { SWRConfig } from "swr";

type SWRProviderProps = {
  children: React.ReactNode;
  fallback?: SWRConfiguration["fallback"];
};

export function SWRProvider({ children, fallback }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        fallback,
      }}
    >
      {children}
    </SWRConfig>
  );
}
