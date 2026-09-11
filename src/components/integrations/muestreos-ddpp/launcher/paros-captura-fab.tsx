"use client";

/**
 * Botón flotante (esquina inferior derecha, visible en todo el dashboard)
 * que abre el modal del feature embebido "Paros / Captura", portado desde
 * el proyecto `muestreos_frontend`. Se monta una sola vez en
 * `src/app/dashboard/layout.tsx`.
 */
import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import ProcesoSelectorModal from "./proceso-selector-modal";

export default function ParosCapturaFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Registrar paro o captura"
        title="Paros / Captura"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <ClipboardCheck className="h-6 w-6" />
      </button>
      <ProcesoSelectorModal open={open} onOpenChange={setOpen} />
    </>
  );
}
