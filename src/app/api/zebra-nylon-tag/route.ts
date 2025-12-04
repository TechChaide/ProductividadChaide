import { NextRequest, NextResponse } from "next/server";
import { getZPLTagNylonChaide, getZPLTagNylonResiflex } from "./functions/zebraNylon-parser";

type ZplNylonInput = {
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
  tapa: string;
  banda: string;
  tapa_tela: string;
  aislante: string;
  lamina_textil: string;
  num_resortes: string;
  peso_max: string;
  espuma_banda: string;
  espuma_tapa: string;
  espuma_material_soporte1: string;
  espuma_material_soporte2: string;
  espuma_material_soporte3: string;
  fecha: string;
  lote: string;
};

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();

    let item: ZplNylonInput | null = null;
    if (Array.isArray(raw) && raw.length > 0) {
      item = raw[0];
    } else if (raw && typeof raw === "object") {
      item = raw as ZplNylonInput;
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
      tapa,
      banda,
      tapa_tela,
      aislante,
      lamina_textil,
      num_resortes,
      peso_max,
      espuma_banda,
      espuma_tapa,
      espuma_material_soporte1,
      espuma_material_soporte2,
      espuma_material_soporte3,
      fecha,
      lote
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
      !EMPRESA ||
      !tapa ||
      !banda ||
      !tapa_tela ||
      !aislante ||
      !lamina_textil ||
      !num_resortes ||
      !peso_max ||
      !espuma_banda ||
      !espuma_tapa ||
      !espuma_material_soporte1 ||
      !espuma_material_soporte2 ||
      !espuma_material_soporte3 ||
      !fecha ||
      !lote
    ) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    let zpl;
    if (EMPRESA == "CHAIDE") {
      zpl = getZPLTagNylonChaide(
        QR,
        garantia,
        tipo,
        clase,
        largo,
        ancho,
        alto,
        nombreProducto,
        mes,
        tapa,
        banda,
        tapa_tela,
        aislante,
        lamina_textil,
        num_resortes,
        peso_max,
        espuma_banda,
        espuma_tapa,
        espuma_material_soporte1,
        espuma_material_soporte2,
        espuma_material_soporte3,
        fecha,
        lote
      );
    } else if (EMPRESA == "RESIFLEX") {
      zpl = getZPLTagNylonResiflex(
        QR,
        garantia,
        tipo,
        clase,
        largo,
        ancho,
        alto,
        nombreProducto,
        mes,
        tapa,
        banda,
        tapa_tela,
        aislante,
        lamina_textil,
        num_resortes,
        peso_max,
        espuma_banda,
        espuma_tapa,
        espuma_material_soporte1,
        espuma_material_soporte2,
        espuma_material_soporte3,
        fecha,
        lote
      );
    }

    return NextResponse.json({ zpl }, { status: 200 });
  } catch (error) {
    console.error("[API /zebra-r] Error:", error);
    return NextResponse.json(
      { error: "Error procesando la solicitud" },
      { status: 400 }
    );
  }
}
