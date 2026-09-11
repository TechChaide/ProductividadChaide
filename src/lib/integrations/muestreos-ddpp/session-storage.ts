/**
 * Sesión propia del feature embebido "Paros / Captura" (backend
 * seguridadesGuard / samplingBA), namespaced en localStorage bajo
 * `muestreosDdpp:*` para no chocar con el `token`/`user` que ya usa
 * ProductividadChaide para su propio login (backend proord).
 */

const KEY_USER = "muestreosDdpp:user";
const KEY_PERFILES = "muestreosDdpp:perfiles";
const KEY_APPS_BY_PROFILE = "muestreosDdpp:appsByProfile";

export interface MuestreosDdppUser {
  codigo_usuario?: number;
  usuario?: string;
  correo_usuario?: string;
  condicion?: string;
  id_usuario?: string;
  codigo_empleado?: string;
  [key: string]: unknown;
}

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getStoredUser(): MuestreosDdppUser | null {
  return readJSON<MuestreosDdppUser>(KEY_USER);
}

export function setStoredUser(user: MuestreosDdppUser): void {
  writeJSON(KEY_USER, user);
}

export function setStoredPerfiles(perfiles: unknown): void {
  writeJSON(KEY_PERFILES, perfiles);
}

export function setStoredAppsByProfile(appsByProfile: unknown): void {
  writeJSON(KEY_APPS_BY_PROFILE, appsByProfile);
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_USER);
  window.localStorage.removeItem(KEY_PERFILES);
  window.localStorage.removeItem(KEY_APPS_BY_PROFILE);
}

/**
 * Extrae `user`/`perfiles`/`message` de una respuesta de login de
 * seguridadesGuard (`loginCentral` o `loginByCodigoEmpleado`), que a
 * veces anida los datos bajo `data`/`data.data` según el endpoint.
 */
export function extractLoginPayload(response: unknown): {
  user: MuestreosDdppUser | null;
  perfiles: unknown;
  message: string | null;
} {
  const layered = (obj: any, keys: string[]): any =>
    keys.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
  const user =
    layered(response, ["user"]) ||
    layered(response, ["data", "user"]) ||
    layered(response, ["data", "data", "user"]) ||
    null;
  const perfiles =
    layered(response, ["perfiles"]) ||
    layered(response, ["data", "perfiles"]) ||
    layered(response, ["data", "data", "perfiles"]);
  const message = layered(response, ["message"]) || layered(response, ["data", "message"]) || null;
  return { user, perfiles, message };
}

/** Guarda `user`/`perfiles` de una respuesta de login ya validada (`user` no nulo). */
export function applyLoginPayload(user: MuestreosDdppUser, perfiles: unknown): void {
  setStoredUser(user);
  if (perfiles) setStoredPerfiles(perfiles);
  setStoredAppsByProfile(perfiles ?? []);
}

/**
 * `codigo_empleado` de la sesión embebida, usado por los servicios
 * portados (registro.service, etc.) igual que en el proyecto origen.
 */
export function getCodigoEmpleadoSesion(): string {
  const user = getStoredUser();
  return String(user?.codigo_empleado ?? "").trim();
}

/**
 * "CodigoPersona" que espera el backend samplingBA para resolver el área
 * del usuario: `id_usuario` si es "Usuario Externo", si no `codigo_empleado`.
 * Equivalente a `getCodigoPersonaFromStorage()` del proyecto origen.
 */
export function getCodigoPersonaSesion(): string {
  const user = getStoredUser();
  if (!user) return "";
  if (user.condicion === "Usuario Externo") {
    return String(user.id_usuario ?? "").trim();
  }
  return String(user.codigo_empleado ?? "").trim();
}

/** Pub/sub minimalista: http-client emite esto en un 401, session-gate lo escucha. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function emitSessionExpired(): void {
  clearStoredSession();
  listeners.forEach((cb) => cb());
}

export function subscribeSessionExpired(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
