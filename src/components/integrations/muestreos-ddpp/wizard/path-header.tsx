"use client";

import { ChevronRight, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";

interface PathHeaderProps {
  /**
   * Segmentos del path en orden de selección.
   * Ej.: ["Producción Quito", "Materia Prima", "Lote / Turno"]
   * El componente los une con el separador `↬` (U+21AC) entre cada par.
   */
  segments: string[];
  /** Texto mostrado cuando aún no hay segmentos. */
  placeholder?: string;
  /** Etiqueta corta sobre el path. */
  label?: string;
  className?: string;
}

/**
 * Cabecera con el path acumulativo de la selección del wizard:
 *
 *   Producción ↬ Materia Prima ↬ Lote / Turno
 *
 * Usa el carácter Unicode `↬` (U+21AC, "DOWNWARDS HARPOON WITH BARB
 * RIGHTWARDS") que pediste. Si no hay segmentos, muestra un placeholder.
 *
 * El componente está pensado para vivir en `samplings/page.tsx` y ser
 * alimentado por cada paso a medida que el usuario avanza:
 *  - Paso 1 (Área):  añade "nombre_area"
 *  - Paso 2 (Motivo): append "nombre_tipo_motivo"
 *  - Paso 3 (Componente): append "nombre_componente"
 *  - Paso N: append "etiqueta"
 */
export default function PathHeader({
  segments,
  placeholder = "Aún no se ha seleccionado ningún elemento",
  label = "Ruta de defectos",
  className,
}: PathHeaderProps) {
  const hasPath = segments.length > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <FolderTree className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {hasPath ? (
          <p
            className="mt-0.5 flex flex-wrap items-center font-medium text-foreground"
            title={segments.join(" ↬ ")}
          >
            {segments.map((seg, i) => (
              <span key={`${seg}-${i}`} className="whitespace-nowrap">
                {i > 0 && (
                  <ChevronRight className="mx-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" />
                )}
                <span>{seg}</span>
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-0.5 text-muted-foreground">{placeholder}</p>
        )}
      </div>
    </div>
  );
}
