
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURLSAP}/api/ordens`;

interface NotificacionParams {
    centro: string;
    responsable: string;
    orden: string;
    cantidad: number;
    cantidad_rechazada: number;
}

// Interface for the direct response from your API, based on the screenshot.
export interface NotificacionResponse {
    message: string;
    dataEnviada: {
        trama: string;
    };
    respuestaSOAP: {
        LcOMsg: string;
        LcOTrama: string;
    };
    [key: string]: any; // To allow for other properties if they exist
}


export const notificacionSAPService = {
  async notificarOrden(params: NotificacionParams): Promise<NotificacionResponse> {

    const response = await fetch(API_URL, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const responseBody = await response.json();

    if (!response.ok) {
        // Even for failed responses, the body might contain useful info.
        // Let's throw an error that includes the body for better debugging.
        // The component will handle the error.
        throw new Error(JSON.stringify(responseBody));
    }

    return responseBody;
  },
};
