"use client";

import { Theme } from "@radix-ui/themes";
import { ChatProvider } from "./ChatProvider";
import Chatbot from "@/components/Chatbot";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { usePathname } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Theme accentColor="purple" grayColor="auto" radius="large" scaling="100%">
        <ChatProvider>
          <GoogleAnalytics />
          {children}
          {!isAdmin && <Chatbot />}
        </ChatProvider>
      </Theme>
    </QueryClientProvider>
  );
}
