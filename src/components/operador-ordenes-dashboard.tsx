"use client";

import { useMemo } from "react";
import { ProductividadOperadoresChart } from "@/components/productividad-operadores-chart";
import { Activity, AlertCircle, Clock, Package } from "lucide-react";

interface Props {
  departamento: string;
  empleadoCodigo: string;
  empleadoNombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  numDias: number;
  datosFechas?: Array<{
    CodEmpleado: string | number;
    Año: number;
    Mes: number;
    Día: number;
    TotalCantidad: number;
    TotalDefectos?: number;
    TotalTiempoSTD?: number;
  }>;
}

function MiniKpi({
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
  color?: "default" | "green" | "yellow" | "red" | "blue";
}) {
  const colores: Record<string, string> = {
    default: "bg-white",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
    blue: "bg-blue-50 border-blue-200",
  };

  return (
    <div className={`rounded-lg border border-border p-3 shadow-sm ${colores[color]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function formatearNumero(n: number, decimales = 1): string {
  return n.toLocaleString("es-EC", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function OperadorOrdenesDashboard({
  departamento,
  empleadoCodigo,
  empleadoNombre,
  fechaInicio,
  fechaFin,
  numDias,
  datosFechas = [],
}: Props) {
  const datosOperador = useMemo(() => {
    return datosFechas.filter((d) => String(d.CodEmpleado) === String(empleadoCodigo));
  }, [datosFechas, empleadoCodigo]);

  const totales = useMemo(() => {
    let totalCantidad = 0;
    let totalDefectos = 0;
    let totalHoras = 0;

    for (const dato of datosOperador) {
      totalCantidad += Number(dato.TotalCantidad) || 0;
      totalDefectos += Number(dato.TotalDefectos) || 0;
      totalHoras += Number(dato.TotalTiempoSTD) || 0;
    }

    return {
      totalCantidad,
      totalDefectos,
      totalHoras,
    };
  }, [datosOperador]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Operador analizado</p>
            <p className="text-base font-semibold text-foreground">{empleadoNombre}</p>
            <p className="text-xs text-muted-foreground">
              Código: {empleadoCodigo} • Departamento: {departamento}
            </p>
          </div>
        </div>
      </div>

      {datosOperador.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniKpi
            icon={<Package className="h-4 w-4" />}
            label="Total producido"
            value={formatearNumero(totales.totalCantidad, 0)}
            sub="Cantidad total del rango"
            color="blue"
          />
          <MiniKpi
            icon={<AlertCircle className="h-4 w-4" />}
            label="Total defectos"
            value={formatearNumero(totales.totalDefectos, 0)}
            sub="Defectos registrados"
            color={totales.totalDefectos > 0 ? "red" : "green"}
          />
          <MiniKpi
            icon={<Clock className="h-4 w-4" />}
            label="Horas trabajadas"
            value={formatearNumero(totales.totalHoras, 2)}
            sub="Tiempo total en horas"
            color="yellow"
          />
          <MiniKpi
            icon={<Activity className="h-4 w-4" />}
            label="Días con actividad"
            value={new Set(datosOperador.map((d) => `${d.Año}-${d.Mes}-${d.Día}`)).size}
            sub="Días con registros"
            color="blue"
          />
        </div>
      )}

      <ProductividadOperadoresChart
        mode="single"
        departamento=""
        cargo=""
        operador={{ codigo: empleadoCodigo, nombre: empleadoNombre }}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        numDias={numDias}
      />
    </div>
  );
}
