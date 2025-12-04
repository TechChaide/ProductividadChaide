import { NextRequest, NextResponse } from "next/server";
import {
  generarZPL,
  generarZPL_EtiquetasNylon,
  generarZPL_EtiquetasNylonResiflex,
  generarZPL_R,
} from "../zebra/functions/zebraParser";
import { sendToNetworkPrinter, PRINTER_PORT } from '../shared/networkPrinter';

type ZplInput = {
  QR: string;
  garantia: string;
  tipo: string;
  clase: string;
  largo: string;
  ancho: string;
  alto: string;
  nombreProducto: string;
  mes: string;
  EMPRESA: string;
  printerIP?: string; // IP opcional de la impresora de red
};

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();

    let item: ZplInput | null = null;
    if (Array.isArray(raw) && raw.length > 0) {
      item = raw[0];
    } else if (raw && typeof raw === "object") {
      item = raw as ZplInput;
    }
    if (!item) {
      return NextResponse.json(
        { error: "Payload vacío o inválido" },
        { status: 400 }
      );
    }

    const {
      QR,
      garantia,
      tipo,
      clase,
      largo,
      ancho,
      alto,
      nombreProducto,
      mes,
      EMPRESA,
      printerIP,
    } = item;
    if (
      !QR ||
      !tipo ||
      !clase ||
      !largo ||
      !ancho ||
      !alto ||
      !nombreProducto ||
      !mes ||
      !EMPRESA
    ) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    let zpl;
    if (EMPRESA == "CHAIDE") {
      zpl = generarZPL_EtiquetasNylon(
        QR,
        garantia,
        tipo,
        clase,
        largo,
        ancho,
        alto,
        nombreProducto,
        mes
      );
    } else if (EMPRESA == "RESIFLEX") {
      zpl = generarZPL_EtiquetasNylonResiflex(
        QR,
        garantia,
        tipo,
        clase,
        largo,
        ancho,
        alto,
        nombreProducto,
        mes
      );
    }

    // Si se proporciona printerIP, imprimir directamente en red
    if (printerIP && zpl) {
      console.log(`[API /zebra-ny] Imprimiendo en red: ${printerIP}`);
      try {
        const result = await sendToNetworkPrinter(zpl, printerIP);
        return NextResponse.json({ 
          success: true,
          message: result.message,
          printer: `${printerIP}:${PRINTER_PORT}`,
          QR: QR
        }, { status: 200 });
      } catch (error) {
        console.error('[API /zebra-ny] Error en impresión de red:', error);
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Error al imprimir en red',
          printer: `${printerIP}:${PRINTER_PORT}`
        }, { status: 500 });
      }
    }

    // Si no hay printerIP, devolver ZPL para BrowserPrint
    console.log('[API /zebra-ny] Devolviendo ZPL para BrowserPrint');
    return NextResponse.json({ zpl }, { status: 200 });
  } catch (error) {
    console.error("[API /zebra-ny] Error:", error);
    return NextResponse.json(
      { error: "Error procesando la solicitud" },
      { status: 400 }
    );
  }
}
