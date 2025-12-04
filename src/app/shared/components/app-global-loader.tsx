"use client";
import React from "react";
import { useUser } from "@/context/user-context";
import GlobalLoader from "@/components/ui/global-loader";

export default function AppGlobalLoader({ children }: { children: React.ReactNode }) {
  const { isLoading } = useUser();
  return <>
    <GlobalLoader show={isLoading} />
    {children}
  </>;
}
