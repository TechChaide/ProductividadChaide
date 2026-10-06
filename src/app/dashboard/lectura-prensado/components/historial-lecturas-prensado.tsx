"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_HISTORIAL_LECTURAS = 5;

/** Resultado de una etiqueta pistoleada: se registra ok solo si se insertó el log de todo el equipo. */
export interface LecturaPrensado {
  id: string;
  codbarras: string;
  orden: string;
  ok: boolean;
  mensaje: string;
  hora: string;
}

/** Últimas etiquetas leídas, la más reciente a la izquierda. */
export default function HistorialLecturasPrensado({ lecturas }: { lecturas: LecturaPrensado[] }) {
  const vacios = Math.max(0, MAX_HISTORIAL_LECTURAS - lecturas.length);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Últimas etiquetas leídas</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {lecturas.map((l, i) => (
          <div
            key={l.id}
            title={l.mensaje}
            className={cn(
              "flex flex-col gap-1 rounded-md border-2 px-3 py-2 transition-opacity",
              i === 0 && "animate-in fade-in slide-in-from-left-4 duration-300",
              l.ok
                ? "border-green-600 bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-100"
                : "border-red-600 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100",
              i > 0 && "opacity-80"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              {l.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-600" />
              )}
              <span className="text-[11px] opacity-70">{l.hora}</span>
            </div>
            <p className="truncate font-mono text-xs font-semibold" title={l.codbarras}>
              {l.codbarras}
            </p>
            <p className="truncate text-xs">
              <span className="opacity-70">Orden:</span> {l.orden || "—"}
            </p>
            {!l.ok && <p className="line-clamp-2 text-[11px] leading-tight">{l.mensaje}</p>}
          </div>
        ))}
        {Array.from({ length: vacios }).map((_, i) => (
          <div
            key={`vacio-${i}`}
            className="hidden min-h-[84px] rounded-md border-2 border-dashed lg:block"
          />
        ))}
      </div>
    </div>
  );
}
