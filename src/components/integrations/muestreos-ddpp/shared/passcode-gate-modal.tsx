"use client";

/**
 * Modal que bloquea la pantalla (fondo con blur, sin poder interactuar)
 * hasta que el usuario ingresa la contraseña `PASSCODE_PAROS`. Se usa
 * antes de arrancar el cronómetro en `/paros` y `/parosM`.
 *
 * Layout de 2 columnas (relación 2-8): la columna izquierda es el panel
 * de marca (azul, logo Chaide — mismo tratamiento que el panel
 * `bg-primary` del login en `src/app/page.tsx`); la derecha es el
 * formulario.
 *
 * Cerrar el modal por cualquier vía (X, Escape, click afuera, botón
 * "Cancelar") dispara `onCancel` — el llamador es responsable de
 * regresar al paso anterior del wizard.
 */
import { useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePasscodeParos } from "@/hooks/integrations/muestreos-ddpp/use-passcode-paros";
import { environment } from "@/environments/environments.prod";

interface PasscodeGateModalProps {
  open: boolean;
  /** Contraseña correcta ingresada. */
  onSuccess: () => void;
  /** Cerrado sin acertar (X, Escape, click afuera, o botón Cancelar). */
  onCancel: () => void;
}

export default function PasscodeGateModal({
  open,
  onSuccess,
  onCancel,
}: PasscodeGateModalProps) {
  const { passcode, isLoading, error: errorConfig } = usePasscodeParos();
  const [valor, setValor] = useState("");
  const [errorIngresado, setErrorIngresado] = useState("");
  const [mostrarValor, setMostrarValor] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValor("");
    setErrorIngresado("");
    setMostrarValor(false);
  }, [open]);

  const handleConfirmar = () => {
    if (!passcode) {
      setErrorIngresado(
        "No se pudo validar: la contraseña no está configurada.",
      );
      return;
    }
    if (valor.trim() === passcode.trim()) {
      onSuccess();
      return;
    }
    setErrorIngresado("Contraseña incorrecta.");
    setValor("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <div className="grid grid-cols-[2fr_8fr]">
          {/* ===== Columna izquierda (2/10): panel de marca ===== */}
          <div className="flex items-center justify-center bg-primary p-3">
            <img
              src={`${environment.basePath}/img/Chide.svg`}
              alt="Chaide"
              className="h-auto w-full max-w-12 object-contain"
            />
          </div>

          {/* ===== Columna derecha (8/10): formulario ===== */}
          <div className="space-y-4 p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Contraseña requerida
              </DialogTitle>
              <DialogDescription>
                Ingresa la contraseña autorizada para iniciar el paro.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="passcode-paros">Contraseña</Label>
              <div className="relative">
                <Input
                  id="passcode-paros"
                  type={mostrarValor ? "text" : "password"}
                  autoFocus
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmar();
                  }}
                  disabled={isLoading}
                  placeholder="••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setMostrarValor((v) => !v)}
                  disabled={isLoading}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label={mostrarValor ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {mostrarValor ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {isLoading ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Cargando configuración...
                </p>
              ) : null}
              {errorIngresado || errorConfig ? (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {errorIngresado || errorConfig}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmar}
                disabled={isLoading || !passcode}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
