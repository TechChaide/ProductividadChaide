
import { environment } from "@/environments/environments.prod";
import type { AuthResponse } from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/auths/login`;

export const authService = {
  async login(codigoEmpleado: string, direccion_ip: string): Promise<AuthResponse> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codigoEmpleado: codigoEmpleado, direccion_ip: direccion_ip }),
    });

    const responseBody = await response.json();

    if (!response.ok || responseBody.user.ficha.Mensaje == 'Colaborador no registrado o inactivo.') {
      // Use the message from the API response if available, otherwise a generic error
      throw new Error(responseBody.user.ficha.Mensaje || responseBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return responseBody;
  },

  async loginColaborador(codigoEmpleado: string): Promise<AuthResponse> {

    const response = await fetch(API_URL+'Colaborador', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codigoEmpleado: codigoEmpleado}),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      // Use the message from the API response if available, otherwise a generic error
      throw new Error(responseBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return responseBody;
  },
};
