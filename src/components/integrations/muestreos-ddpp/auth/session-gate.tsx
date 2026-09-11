"use client";

/**
 * Envuelve el wizard de Paros/Captura. Método "mixto":
 *  1. Si ya hay sesión guardada (namespaced), pasa directo.
 *  2. Si no, y ProductividadChaide ya conoce al usuario (tiene `code` en
 *     su propio UserContext, es decir ya inició sesión en `proord`),
 *     intenta un login SILENCIOSO contra seguridadesGuard vía
 *     `loginByCodigoEmpleado` — sin pedir contraseña. El backend solo
 *     acepta esto para `nombre_aplicacion = "APP_PRODUCTIVIDAD_WEB"`.
 *  3. Si el login silencioso falla (o no hay `code` disponible), cae al
 *     login embebido manual (usuario/contraseña).
 * También se re-dispara si la cookie expira a mitad de uso (401 en
 * cualquier llamada -> `emitSessionExpired`).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  applyLoginPayload,
  extractLoginPayload,
  getStoredUser,
  subscribeSessionExpired,
} from "@/lib/integrations/muestreos-ddpp/session-storage";
import { authMuestreosDdppService } from "@/services/integrations/muestreos-ddpp/auth.service";
import { useUser } from "@/context/user-context";
import EmbeddedLoginForm from "./embedded-login-form";

export default function SessionGate({ children }: { children: ReactNode }) {
  const { user: contextUser } = useUser();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (getStoredUser()) {
        if (!cancelled) {
          setAuthenticated(true);
          setChecking(false);
        }
        return;
      }

      const codigoEmpleado = contextUser?.code?.trim();
      if (codigoEmpleado) {
        try {
          const response = await authMuestreosDdppService.loginByCodigoEmpleado(codigoEmpleado);
          const { user, perfiles } = extractLoginPayload(response);
          if (user) {
            applyLoginPayload(user, perfiles);
            if (!cancelled) {
              setAuthenticated(true);
              setChecking(false);
            }
            return;
          }
        } catch {
          // Login silencioso no disponible (app no autorizada, usuario no
          // encontrado en seguridadesGuard, etc.) — cae al login manual.
        }
      }

      if (!cancelled) {
        setAuthenticated(false);
        setChecking(false);
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextUser?.code]);

  useEffect(() => {
    return subscribeSessionExpired(() => {
      setAuthenticated(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authenticated) {
    return <EmbeddedLoginForm onSuccess={() => setAuthenticated(true)} />;
  }

  return <>{children}</>;
}
