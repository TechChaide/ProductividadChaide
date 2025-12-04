"use client";
import React from "react";
import { UserProvider } from "@/context/user-context";
import AppGlobalLoader from "@/app/shared/components/app-global-loader";
import { Toaster } from "@/components/ui/toaster";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <AppGlobalLoader>
        {children}
      </AppGlobalLoader>
      <Toaster />
    </UserProvider>
  );
}
