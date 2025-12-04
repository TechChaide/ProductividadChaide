"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";
import { sesionService } from "@/services/sesion.service";
import { estacionService } from "@/services/estacion.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, Activity, BarChart3 } from "lucide-react";
import type { Estacion } from "@/types/interfaces";

export interface SesionMetrica {
  codigo_estacion: number;
  total_sesiones_completadas: number;
  suma_tiempo_total_logueado_seg: number;
  suma_tiempo_total_formato: string;
  duracion_promedio_sesion_seg: number;
  duracion_promedio_sesion_formato: string;
}

export interface MetricaConEstacion extends SesionMetrica {
  estacion?: Estacion;
}

export function MetricasSesionesCard() {
  const { user } = useUser();
  const [metricas, setMetricas] = useState<MetricaConEstacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.code) return;

    const cargarMetricas = async () => {
      try {
        setLoading(true);
        const response = await sesionService.getMetricasPorCodigoEmpleado(user.code);
        const metricasData = response.data || [];

        // Enriquecer métricas con información de estación
        const metricasConEstacion = await Promise.all(
          metricasData.map(async (metrica: SesionMetrica) => {
            try {
              const estacionResponse = await estacionService.getById(metrica.codigo_estacion);
              return {
                ...metrica,
                estacion: estacionResponse.data,
              };
            } catch (err) {
              console.error(`Error al cargar estación ${metrica.codigo_estacion}:`, err);
              return metrica;
            }
          })
        );

        setMetricas(metricasConEstacion);
        setError(null);
      } catch (err) {
        console.error("Error al cargar métricas:", err);
        setError("No se pudieron cargar las métricas de sesión");
        setMetricas([]);
      } finally {
        setLoading(false);
      }
    };

    cargarMetricas();
  }, [user?.code]);

  if (loading) {
    return (
      <Card className="w-full bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Métricas de Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-primary/10 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-destructive/10 border-destructive/20">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive/80">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (metricas.length === 0) {
    return (
      <Card className="w-full bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Métricas de Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay datos de sesión disponibles para mostrar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {metricas.map((metrica) => (
        <Card key={metrica.codigo_estacion} className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {metrica.codigo_estacion}
                </span>
              </div>
              <span>{metrica.estacion?.nombre_estacion || `Estación ${metrica.codigo_estacion}`}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Total de sesiones */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Sesiones completadas</span>
              </div>
              <span className="font-semibold text-primary">
                {metrica.total_sesiones_completadas}
              </span>
            </div>

            {/* Tiempo total */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Tiempo total</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-blue-500">
                  {metrica.suma_tiempo_total_formato}
                </span>
                <p className="text-xs text-muted-foreground">
                  ({metrica.suma_tiempo_total_logueado_seg}s)
                </p>
              </div>
            </div>

            {/* Duración promedio */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Duración promedio</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-green-500">
                  {metrica.duracion_promedio_sesion_formato}
                </span>
                <p className="text-xs text-muted-foreground">
                  ({metrica.duracion_promedio_sesion_seg.toFixed(2)}s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
