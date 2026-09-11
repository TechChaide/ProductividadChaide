"use client";

/**
 * FlipClock reutilizable (sin modal) para mostrar el cronómetro de un
 * paro dentro del flujo `/dashboard/procesos/paros`.
 *
 * Réplica del mismo efecto visual que `ParoEnCursoModal` (flip cards
 * 3D que rotan al cambiar el dígito), pero pensado para renderizarse
 * INLINE dentro de un card del formulario — sin overlays, sin bloqueo
 * de teclado, sin TooltipProvider.
 *
 * Animación:
 *   Cada FlipCard mantiene en estado el dígito ANTERIOR y el NUEVO.
 *   Cuando cambia, reproduce una animación CSS de 0.6s con dos paneles
 *   (superior cae hacia adelante, inferior cae desde atrás) que recrea
 *   el efecto clásico de un flip clock mecánico.
 *
 * SSR-safe: no anima en el primer render del cliente.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface ParoFlipClockProps {
  /** Segundos transcurridos del paro. */
  segundos: number;
  /** Si está corriendo el cronómetro (afecta color y animación). */
  enCurso: boolean;
}

/** Split del tiempo en HH:MM:SS con padding a 2 dígitos. */
function splitHMS(s: number): { hh: string; mm: string; ss: string } {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { hh: pad(hh), mm: pad(mm), ss: pad(ss) };
}

/* ─────────────────────────────────────────────────────────────────────────
 *  FlipCard — un solo dígito con animación 3D al cambiar
 *  ──────────────────────────────────────────────────────────────────────── */

interface FlipCardProps {
  value: string;
}

function FlipCard({ value }: FlipCardProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const previousRef = React.useRef<string>(value);
  const [flipping, setFlipping] = React.useState(false);

  React.useEffect(() => {
    if (!mounted) return;
    if (previousRef.current === value) return;
    setFlipping(true);
    const t = window.setTimeout(() => {
      previousRef.current = value;
      setFlipping(false);
    }, 600);
    return () => window.clearTimeout(t);
  }, [value, mounted]);

  const previous = previousRef.current;

  return (
    <div
      className={cn(
        "relative h-16 w-12 sm:h-20 sm:w-16",
        "rounded-md overflow-hidden",
        "shadow-[0_4px_12px_rgba(0,85,184,0.35)]",
      )}
      style={{ perspective: "200px" }}
    >
      <div
        className={cn(
          "flip-card__top",
          flipping && "flip-card__top--flipping",
        )}
      >
        <span className="flip-card__num">{flipping ? previous : value}</span>
      </div>
      <div
        className={cn(
          "flip-card__bottom",
          flipping && "flip-card__bottom--flipping",
        )}
      >
        <span className="flip-card__num">{value}</span>
      </div>
      <div className="flip-card__divider" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  FlipClockGroup + FlipSeparator — compaginan los grupos HH : MM : SS
 *  ──────────────────────────────────────────────────────────────────────── */

function FlipClockGroup({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">
        <FlipCard value={value[0]} />
        <FlipCard value={value[1]} />
      </div>
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-600 sm:text-xs">
        {label}
      </span>
    </div>
  );
}

function FlipSeparator() {
  return (
    <div className="flex h-16 sm:h-20 items-center pb-5 sm:pb-6">
      <span className="text-3xl font-light text-slate-400 sm:text-4xl">:</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Componente público
 *  ──────────────────────────────────────────────────────────────────────── */

export default function ParoFlipClock({ segundos, enCurso }: ParoFlipClockProps) {
  const { hh, mm, ss } = splitHMS(segundos);
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        enCurso && "animate-pulse-slow",
      )}
    >
      <div className="flex items-start gap-1">
        <FlipClockGroup label="hh" value={hh} />
        <FlipSeparator />
        <FlipClockGroup label="mm" value={mm} />
        <FlipSeparator />
        <FlipClockGroup label="ss" value={ss} />
      </div>
      <p
        className={cn(
          "text-[11px] font-medium uppercase tracking-wider",
          enCurso ? "text-red-600" : "text-muted-foreground",
        )}
      >
        {enCurso ? "Paro en curso" : "Paro detenido"}
      </p>
    </div>
  );
}