"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";
import { servicioService } from "@/services/servicioDashboard.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperadorOrdenesDashboard } from "@/components/operador-ordenes-dashboard";
import { ProductividadDiariaCard } from "@/components/productividad-diaria-card";
import {
  TrendingUp,
  Package,
  CheckCircle2,
  XCircle,
  Target,
  BarChart2,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";

interface VentanaOrden {
  Orden: string;
  Fecha: string;
  Material: string;
  Nombre: string;
  CantProgramada: number;
  CantNotificada: number;
  CantRechazo: number;
  RespCtrlProd: string;
  Maquina: string;
}

type KPIColor = "default" | "green" | "yellow" | "red";

function KPITile({
  icon,
  label,
  value,
  sub,
  color = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: KPIColor;
}) {
  const wrapper: Record<KPIColor, string> = {
    default: "bg-muted/50 border border-border",
    green: "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800",
    yellow: "bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
    red: "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800",
  };
  const text: Record<KPIColor, string> = {
    default: "text-foreground",
    green: "text-green-700 dark:text-green-400",
    yellow: "text-yellow-700 dark:text-yellow-400",
    red: "text-red-700 dark:text-red-400",
  };

  return (
    <div className={`rounded-lg p-4 flex flex-col gap-1 ${wrapper[color]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold leading-tight ${text[color]}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function pctColor(pct: number): KPIColor {
  if (pct >= 90) return "green";
  if (pct >= 70) return "yellow";
  return "red";
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFechaFiltroVentanaLaboral(baseDate: Date = new Date()): string {
  const fecha = new Date(baseDate);
  const diaSemana = fecha.getDay();

  // Domingo -> viernes, lunes -> viernes, sÃ¡bado -> viernes, resto -> dÃ­a anterior.
  let diasARestar = 1;
  if (diaSemana === 1) diasARestar = 3;
  if (diaSemana === 0) diasARestar = 2;
  if (diaSemana === 6) diasARestar = 1;

  fecha.setDate(fecha.getDate() - diasARestar);
  return formatDateLocal(fecha);
}

interface Habilidad {
  CodigoOperador?: string;
  Centro?: number;
  RespCtrlProd?: string;
  PuestoTrabajo?: string;
  PuestoTrabajoLinea?: string;
  Rol?: string;
  Calificacion?: number;
  Prioridad?: number;
}

function calificacionColor(c: number): string {
  if (c >= 100) return "bg-green-500";
  if (c >= 75) return "bg-lime-500";
  if (c >= 50) return "bg-yellow-500";
  return "bg-red-400";
}

function calificacionLabel(c: number): string {
  if (c >= 100) return "Experto";
  if (c >= 75) return "Avanzado";
  if (c >= 50) return "Intermedio";
  return "BÃ¡sico";
}

export function DashboardEmpleadoCard({ showTiempoEstimado = true }: { showTiempoEstimado?: boolean }) {
  const { user } = useUser();
  const [ordenes, setOrdenes] = useState<VentanaOrden[]>([]);
  const [tiempoEstimadoPorOrden, setTiempoEstimadoPorOrden] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [habilidades, setHabilidades] = useState<Habilidad[]>([]);
  const [loadingHabilidades, setLoadingHabilidades] = useState(false);
  const [errorHabilidades, setErrorHabilidades] = useState<string | null>(null);
  const ITEMS_PER_VIEW = 3;

  useEffect(() => {
    // Esta funcionalidad se maneja en OperadorOrdenesDashboard
    setLoading(false);
  }, [user?.machine]);

  useEffect(() => {
    let codigo = user?.code ?? sessionStorage.getItem("usuario_codigo") ?? "";
    if (!codigo || codigo === "admin") return;

    setLoadingHabilidades(true);
    setErrorHabilidades(null);

    servicioService
      .getHabilidadesOperadorPorCodigoOperador(codigo)
      .then((res) => {
        const raw = (res.data as Habilidad[]) ?? [];
        // Deduplicar por PuestoTrabajo+PuestoTrabajoLinea; conservar el de mayor Calificacion
        const mapa = new Map<string, Habilidad>();
        for (const hab of raw) {
          const clave = `${hab.PuestoTrabajo ?? ""}|||${hab.PuestoTrabajoLinea ?? ""}`;
          const existente = mapa.get(clave);
          if (!existente || (hab.Calificacion ?? 0) > (existente.Calificacion ?? 0)) {
            mapa.set(clave, hab);
          }
        }
        setHabilidades(Array.from(mapa.values()));
      })
      .catch(() => setErrorHabilidades("No se pudieron cargar las habilidades."))
      .finally(() => setLoadingHabilidades(false));
  }, [user?.code]);

  useEffect(() => {
    if (!showTiempoEstimado) {
      setTiempoEstimadoPorOrden({});
      return;
    }

    if (!ordenes.length) {
      setTiempoEstimadoPorOrden({});
      return;
    }

    let cancelado = false;

    const variantesMaterial = (material: string): string[] => {
      const limpio = material.trim();
      const sinCeros = limpio.replace(/^0+/, "");
      const variantes = [limpio];

      if (sinCeros && sinCeros !== limpio) {
        variantes.push(sinCeros);
      }

      return variantes;
    };

    const cargarTiempoEstimado = async () => {
      const estimados: Record<string, number> = {};
      const tiempoMaximoPorPar: Record<string, number> = {};
      const paresUnicos = Array.from(
        new Map(
          ordenes
            .map((orden) => ({
              hojaRuta: String(orden.Maquina ?? "").trim(),
              material: String(orden.Material ?? "").trim(),
            }))
            .filter((par) => !!par.hojaRuta && !!par.material)
            .map((par) => [`${par.hojaRuta}|||${par.material}`, par])
        ).values()
      );

      await Promise.all(
        paresUnicos.map(async ({ hojaRuta, material }) => {
          try {
            const materialesAConsultar = variantesMaterial(material);
            const tiempos: number[] = [];

            for (const mat of materialesAConsultar) {
              const respuesta = await servicioService.getTiempoProduccionMedioMaterial(
                hojaRuta,
                mat
              );

              const tiemposRespuesta = (respuesta.data ?? [])
                .map((item: any) => Number(item?.Tiempo_Min))
                .filter((valor: number) => Number.isFinite(valor));

              tiempos.push(...tiemposRespuesta);

              if (tiemposRespuesta.length > 0) {
                break;
              }
            }

            if (!tiempos.length) {
              return;
            }

            tiempoMaximoPorPar[`${hojaRuta}|||${material}`] = Math.max(...tiempos);
          } catch {
            // Si falla una consulta puntual, se omite el badge de esa orden.
          }
        })
      );

      ordenes.forEach((orden) => {
        const hojaRuta = String(orden.Maquina ?? "").trim();
        const material = String(orden.Material ?? "").trim();
        const claveOrden = `${orden.Orden}-${material}-${hojaRuta}`;
        const tiempoMaximoMin = tiempoMaximoPorPar[`${hojaRuta}|||${material}`];

        if (typeof tiempoMaximoMin !== "number" || !Number.isFinite(tiempoMaximoMin)) {
          return;
        }

        const metaOrden = Number(orden.CantProgramada) || 0;
        estimados[claveOrden] = tiempoMaximoMin * metaOrden;
      });

      if (!cancelado) {
        setTiempoEstimadoPorOrden(estimados);
      }
    };

    cargarTiempoEstimado();

    return () => {
      cancelado = true;
    };
  }, [ordenes, showTiempoEstimado]);

  const totalPlanificado = ordenes.reduce((s, o) => s + (Number(o.CantProgramada) || 0), 0);
  const totalProducido = ordenes.reduce((s, o) => s + (Number(o.CantNotificada) || 0), 0);
  const totalRechazo = ordenes.reduce((s, o) => s + (Number(o.CantRechazo) || 0), 0);
  const avanceGlobalPct =
    totalPlanificado > 0
      ? Math.min(100, Math.round((totalProducido / totalPlanificado) * 100))
      : 0;
  const eficiencia = totalPlanificado > 0 ? Math.round((totalProducido / totalPlanificado) * 100) : 0;
  const fpy =
    totalPlanificado > 0
      ? Math.round(((totalProducido - totalRechazo) / totalPlanificado) * 100)
      : 0;
  const ordenesOrdenadasPorAvance = [...ordenes]
    .map((orden) => {
      const planificado = Number(orden.CantProgramada) || 0;
      const producido = Number(orden.CantNotificada) || 0;
      const rechazo = Number(orden.CantRechazo) || 0;
      const pct =
        planificado > 0
          ? Math.min(100, Math.round((producido / planificado) * 100))
          : 0;

      return { orden, planificado, producido, rechazo, pct };
    })
    .sort((a, b) => b.pct - a.pct || b.producido - a.producido);

  const fechaDisplay = new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fechaInicioVentana = getFechaFiltroVentanaLaboral();
  const [yearInicio, monthInicio, dayInicio] = fechaInicioVentana
    .split("-")
    .map(Number);
  const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio);
  const fechaInicioVentanaDisplay = fechaInicioDate.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (

    <EstadisticasOperadorTab
      departamento={user?.department ?? ""}
      codigo={user?.code ?? ""}
      nombre={user?.name ?? "Operador"}
    />

  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Subcomponente: tab "Mis estadisticas" â€” reutiliza el dashboard "Por operador"
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EstadisticasOperadorTab({
  departamento,
  codigo,
  nombre,
}: {
  departamento: string;
  codigo: string;
  nombre: string;
}) {
  if (!departamento || !codigo || codigo === "admin") {
    return (
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-sm text-muted-foreground">
          No se pueden mostrar estadisticas: falta el departamento o el codigo del operador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProductividadDiariaCard codigoEmpleado={codigo} nombre={nombre} />
    </div>
  );
}