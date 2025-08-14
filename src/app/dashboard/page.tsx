
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/user-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If not loading and user is an operator, redirect
    if (!isLoading && user?.code !== 'admin') {
      router.replace('/dashboard/pedidos');
    }
  }, [user, isLoading, router]);

  // While loading or if user is an operator, show a loading/placeholder state
  if (isLoading || user?.code !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </CardContent>
      </Card>
    );
  }

  // If user is admin and not loading, show the dashboard
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          Bienvenido al panel de la aplicación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Selecciona una opción del menú lateral para comenzar.</p>
      </CardContent>
    </Card>
  );
}
