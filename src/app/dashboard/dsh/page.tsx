"use client";

import { DashboardDshCard } from "@/components/dashboard-dsh-card";
import { Badge } from "@/components/ui/badge";
import { Activity, LayoutGrid, Sparkles } from "lucide-react";

export default function DashboardDshPage() {
  return (
    <div className="space-y-6 overflow-x-hidden p-6">

      <DashboardDshCard />
      
    </div>
  );
}
