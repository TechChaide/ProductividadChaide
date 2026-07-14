import { NextRequest, NextResponse } from "next/server";
import {
  esNDB,
  esVacio,
  generarZPL,
  generarZPL_EtiquetasNylon,
  generarZPL_EtiquetasNylonResiflex,
  generarZPL_EtiquetasNylonPremium,
  generarZPL_EtiquetasNylonChaidem,
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

    // Campos que el SP devuelve como "NDB" cuando el material no está en el maestro:
    // se omiten en la etiqueta y se informan al cliente para que muestre la alerta.
    const camposNDB = Object.entries({ tipo, clase, largo, ancho, alto })
      .filter(([, valor]) => esNDB(valor))
      .map(([campo]) => campo);

    // La garantía llega vacía cuando el código antiguo del material SAP no tiene
    // el sufijo de garantía configurado por planificación: se omite en la etiqueta
    // y se informa al cliente para que muestre la alerta.
    const garantiaVacia = esVacio(garantia);

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
    }else if (EMPRESA == "PREMIUM") {
      // Nuevo método para la empresa PREMIUM
      zpl = generarZPL_EtiquetasNylonPremium(
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
    } else if (EMPRESA == "CHAIDEM") {
      // Nuevo método para la empresa CHAIDEM
      zpl = generarZPL_EtiquetasNylonChaidem(
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
          QR: QR,
          camposNDB: camposNDB,
          garantiaVacia: garantiaVacia
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
    return NextResponse.json({ zpl, camposNDB, garantiaVacia }, { status: 200 });
  } catch (error) {
    console.error("[API /zebra-ny] Error:", error);
    return NextResponse.json(
      { error: "Error procesando la solicitud" },
      { status: 400 }
    );
  }
}
