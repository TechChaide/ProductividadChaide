/**
 * Fetch wrapper para el backend seguridadesGuard/samplingBA (sesión por
 * cookie httpOnly). Adaptado de `muestreos_frontend/src/lib/http-client.ts`:
 * en un 401 NO redirige ni toca el `token`/`user` de ProductividadChaide —
 * solo limpia la sesión namespaced de este feature y notifica a
 * `session-gate.tsx` (vía `emitSessionExpired`) para que vuelva a mostrar
 * el login embebido.
 */
import { emitSessionExpired } from "@/lib/integrations/muestreos-ddpp/session-storage";

export type FetchOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {},
) {
  const { skipAuth = false, ...restOptions } = options;

  const response = await fetch(url, {
    ...restOptions,
    credentials: skipAuth ? "omit" : "include",
  });

  if (response.status === 401) {
    emitSessionExpired();
  }

  return response;
}
