"use client";

/**
 * Login embebido para el feature Paros/Captura, contra el backend
 * seguridadesGuard (mismo backend de auth que usa `muestreos_frontend`,
 * distinto del login propio de ProductividadChaide contra `proord`).
 *
 * Es una sesión aparte, con su propia cookie httpOnly y su propio
 * localStorage namespaced (`muestreosDdpp:*`, ver session-storage.ts) —
 * no toca ni reemplaza el `token`/login existente de ProductividadChaide.
 *
 * Simplificación deliberada frente al login original: solo soporta
 * usuario/contraseña. El proyecto origen también ofrece login facial
 * (cámara + backend de reconocimiento facial aparte); se omitió aquí
 * para no arrastrar esa dependencia extra dentro de un modal-en-modal.
 * Si se necesita más adelante, el patrón está en
 * `muestreos_frontend/src/app/page.tsx` + `camera-modal.tsx`.
 */
import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { authMuestreosDdppService } from "@/services/integrations/muestreos-ddpp/auth.service";
import {
  applyLoginPayload,
  extractLoginPayload,
} from "@/lib/integrations/muestreos-ddpp/session-storage";
import { useUser } from "@/context/user-context";

interface EmbeddedLoginFormProps {
  onSuccess: () => void;
}

export default function EmbeddedLoginForm({ onSuccess }: EmbeddedLoginFormProps) {
  const { user: contextUser } = useUser();
  const [usuario, setUsuario] = useState(contextUser?.code ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!usuario.trim() || !password) {
      setError("Ingresa usuario y contraseña.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await authMuestreosDdppService.loginCentral({
        email: usuario.trim(),
        password,
      });

      const { user, perfiles, message } = extractLoginPayload(response);

      if (!user) {
        setError(
          message ? `Respuesta inválida del servidor: ${message}` : "Credenciales incorrectas.",
        );
        return;
      }

      applyLoginPayload(user, perfiles);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Inicia sesión para continuar</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Este proceso usa el sistema de Muestreos/DDPP. Ingresa tu usuario y
          contraseña (independiente de tu sesión de ProductividadChaide).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-left">
        <div className="space-y-2">
          <Label htmlFor="muestreos-usuario">Usuario</Label>
          <Input
            id="muestreos-usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="nombre.apellido o documento"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="muestreos-password">Contraseña</Label>
          <div className="relative">
            <Input
              id="muestreos-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error de autenticación</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>
    </div>
  );
}
