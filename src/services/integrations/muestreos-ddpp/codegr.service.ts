import type { InformacionExterna, OrdenesTrabajadas } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";

const API_URL_qr = `${environment.apiScanner}/api/qr`;
const API_URL_bc = `${environment.apiScanner}/api/barcode`;

/** Límite de 16 MB que define la API (status 413 si se excede). */
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

/** Modos de envío soportados por los endpoints /read. */
export type ReadMode = "multipart" | "json";

export interface QRGenerateOptions {
  error_correction?: "L" | "M" | "Q" | "H";
  box_size?: number;
  border?: number;
  fill_color?: string;
  back_color?: string;
}

export interface BarcodeGenerateOptions {
  format?:
    | "code128"
    | "code39"
    | "ean13"
    | "ean8"
    | "upc"
    | "upc-e"
    | "codabar"
    | "itf"
    | "code93";
  write_text?: boolean;
  module_width?: number;
  module_height?: number;
  quiet_zone?: number;
  font_size?: number;
  text_distance?: number;
  foreground?: string;
  background?: string;
}

/**
 * Convierte un string base64 (con o sin prefijo data:image/...;base64,)
 * en un objeto Blob listo para enviarse dentro de un FormData.
 */
function base64ToBlob(base64: string): Blob {
  const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;

  const byteCharacters = atob(cleanBase64);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  const mimeMatch = base64.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";

  return new Blob(byteArrays, { type: mimeType });
}

function toImageBlob(input: File | Blob | string): Blob {
  if (input instanceof Blob) return input;
  return base64ToBlob(input);
}

function getSizeBytes(input: File | Blob | string): number {
  if (typeof input === "string") {
    const clean = input.includes(",") ? input.split(",")[1] : input;
    const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
    return Math.floor((clean.length * 3) / 4) - padding;
  }
  return input.size;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function postRead(
  url: string,
  payload: { mode: ReadMode; input: File | Blob | string },
  fieldName: string
): Promise<Response> {
  const size = getSizeBytes(payload.input);
  if (size > MAX_IMAGE_BYTES) {
    throw new Error(
      `La imagen supera el límite permitido (16 MB). Tamaño: ${(
        size /
        (1024 * 1024)
      ).toFixed(2)} MB`
    );
  }

  if (payload.mode === "json") {
    const base64 =
      payload.input instanceof Blob
        ? await blobToBase64(payload.input)
        : payload.input;

    return fetchWithAuth(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: base64 }),
    });
  }

  const formData = new FormData();
  const blob = toImageBlob(payload.input);
  const ext =
    blob.type && blob.type.startsWith("image/")
      ? blob.type.split("/")[1]
      : "png";
  formData.append(fieldName, blob, `image.${ext}`);

  // NO seteamos Content-Type: el navegador añade el boundary correcto.
  return fetchWithAuth(url, {
    method: "POST",
    body: formData,
  });
}

async function parseError(response: Response): Promise<string> {
  const errorBody = await response
    .json()
    .catch(() => ({ message: "Error desconocido" }));
  return errorBody.message || `Request failed (status ${response.status})`;
}

export const codesGRService = {
  /**
   * Lee un QR a partir de una imagen (File/Blob) o string base64.
   */
  async readQR(
    image: File | Blob | string,
    mode: ReadMode = "multipart"
  ): Promise<BodyListResponse<any>> {
    const response = await postRead(
      `${API_URL_qr}/read`,
      { mode, input: image },
      "image"
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  },

  async generateQR(
    data: string | string[],
    options?: QRGenerateOptions
  ): Promise<BodyListResponse<any>> {
    const body: Record<string, unknown> = { data };
    if (options) body.options = options;

    const response = await fetchWithAuth(`${API_URL_qr}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  },

  async readBarcode(
    image: File | Blob | string,
    mode: ReadMode = "multipart"
  ): Promise<BodyResponse<any>> {
    const response = await postRead(
      `${API_URL_bc}/read`,
      { mode, input: image },
      "image"
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  },

  async generateBarcode(
    data: string | string[],
    options?: BarcodeGenerateOptions
  ): Promise<BodyListResponse<any>> {
    const body: Record<string, unknown> = { data };
    if (options) body.options = options;

    const response = await fetchWithAuth(`${API_URL_bc}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  },

  async getInformacionUsuarioExternoByIdentificacion(
    codigo: string
  ): Promise<BodyResponse<InformacionExterna>> {
    const response = await fetchWithAuth(`${API_URL_bc}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Identificador: codigo }),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  },

  async getInformacionOrdenesByResponsblesYCaso(
    data: string
  ): Promise<BodyListResponse<OrdenesTrabajadas>> {
    const response = await fetchWithAuth(
      `${API_URL_bc}/getOrdenesTrabajadas`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      }
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  },
};
