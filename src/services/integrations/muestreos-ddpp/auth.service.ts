import type { Auth } from "@/types/integrations/muestreos-ddpp";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";
import { BodyListResponse } from "@/types/body-list-response";

const API_URL_CENTRAL = `${environment.apiURL_Guard}/api/auths/loginCentral`;
const API_URL_POR_CODIGO = `${environment.apiURL_Guard}/api/auths/loginByCodigoEmpleado`;
const API_URL = environment.apiURL_Guard;

// Tipo para login facial/central — acepta string o el objeto facial
type LoginCentralCredentials = {
  email: string;
  password:
    | string
    | {
        CODIGO: string;
        NOMBRE: string;
        DEPARTAMENTO?: string;
        CENTRO?: string;
      };
};

export const authMuestreosDdppService = {
  async loginCentral(credentials: LoginCentralCredentials): Promise<BodyResponse<Auth>> {
    const response = await fetchWithAuth(API_URL_CENTRAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      skipAuth: false,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error al iniciar sesión.' }));
      throw new Error(errorBody.message || 'Ocurrió un error desconocido.');
    }

    return response.json() as Promise<BodyResponse<Auth>>;
  },

  /**
   * Login "mixto": sin contraseña, solo con `codigo_empleado` — para
   * cuando el usuario YA se autenticó en ProductividadChaide (tiene su
   * propio token de `proord`) y solo falta abrir sesión aquí, en
   * seguridadesGuard, para poder consumir samplingBA. El backend solo
   * acepta esto para `nombre_aplicacion = environment.nombreAplicacion`
   * ("APP_PRODUCTIVIDAD_WEB"); cualquier otra app recibe 403.
   */
  async loginByCodigoEmpleado(codigoEmpleado: string): Promise<BodyResponse<Auth>> {
    const response = await fetchWithAuth(API_URL_POR_CODIGO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo_empleado: codigoEmpleado,
        nombre_aplicacion: environment.nombreAplicacion,
      }),
      skipAuth: false,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error al iniciar sesión.' }));
      throw new Error(errorBody.message || 'Ocurrió un error desconocido.');
    }

    return response.json() as Promise<BodyResponse<Auth>>;
  },

  async getUsersInfo(): Promise<BodyListResponse<any[]>> {
    const response = await fetchWithAuth(`${API_URL}/api/usuarios/fichasUsuarios`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error al obtener usuarios.' }));
      throw new Error(errorBody.message || 'Ocurrió un error desconocido.');
    }

    return response.json();
  },
};
