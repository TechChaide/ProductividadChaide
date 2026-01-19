import React from "react";
import Barcode from "@/components/ui/barcode";
import QRCodeComponent from "@/components/ui/qrcode";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import type { Order, OrderAlmohadas } from "@/types/order";

type Props = {
  //order: OrderAlmohadas & { codigo_barras?: string };
  codigoBarras: string;
  añosGarantia: number;
  tipo: string;
  clase: string;
  dimensiones: {
    ancho: number;
    largo: number;
    alto: number;
  };
  producto?: string;
  empresa?: string;
  className?: string;

  /////Elementos extras para los detalles de materiales de la etiqueta de nylon
  tapa?: string;
  banda?: string;
  tela_tapa?: string;
  aislante?: string;
  lamina_textil?: string;
  numero_resortes?: string;
  peso_maximo_individual?: string;

  espuma_banda?: string;
  espuma_tapa?: string;
  R1?: string;
  R2?: string;
  R3?: string;
  LOTE?: string;
};

export default function OrderStickerCambioPlastico({
  //order,
  codigoBarras,
  añosGarantia,
  tipo,
  clase,
  dimensiones,
  producto,
  empresa,
  className = "",

  ///////////////////////////////Elementos extras detalles material
  tapa,
  banda,
  tela_tapa,
  aislante,
  lamina_textil,
  numero_resortes,
  peso_maximo_individual,

  espuma_banda,
  espuma_tapa,
  R1,
  R2,
  R3,
  LOTE,
}: Props) {
  if (!codigoBarras) return null;

  // Generar el código QR con el código de barras
  const qrCodeValue = codigoBarras;

  // Función para determinar qué logo mostrar basado en la empresa
  const getLogoSrc = () => {
    if (!empresa) return "/img/chaideF.png"; // Default

    const empresaLower = empresa.toLowerCase();

    if (empresaLower.includes("resiflex")) {
      return "/img/resiflex.jpg";
    } else if (empresaLower.includes("chaide")) {
      return "/img/chaideF.png";
    } else {
      return "/img/chaideF.png"; // Default para cualquier otra empresa
    }
  };

  const getLogoAlt = () => {
    if (!empresa) return "Logo Chaide";

    const empresaLower = empresa.toLowerCase();

    if (empresaLower.includes("resiflex")) {
      return "Logo Resiflex";
    } else if (empresaLower.includes("chaide")) {
      return "Logo Chaide";
    } else {
      return `Logo ${empresa}`;
    }
  };

  return (
    <Card
      className={`w-full h-full flex-1 border border-gray-300 ${className}`}
    >
      <CardContent className="p-1 w-full h-full">
        {/* Grilla principal - 2 filas x 2 columnas */}
        <div className="w-full">
          {/* Superior izquierda: QR pequeño y código de barras */}
          <div className="flex flex-row items-start justify-start space-y-2">
            <QRCodeComponent value={qrCodeValue} size={36} />
            <div className="text-sm font-bold tracking-wide break-all ml-2">
              {codigoBarras}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 w-full">
          {/* Superior derecha: Logo and warranty circle */}
          <div className="flex flex-col items-center justify-center">
            <Image
              src={getLogoSrc()}
              alt={getLogoAlt()}
              width={250}
              height={250}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-0 w-full">
          {/* Superior derecha: Logo y círculo de garantía */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-center">
              <h2 className="text-sm font-bold">
                Garantía de {añosGarantia} AÑOS
              </h2>
              <p className="text-xs text-gray-600">
                Escanea el código QR, activa tu garantía
                <br />y recibe un año adicional gratis.
              </p>
            </div>

            <div className="flex flex-col justify-start text-sm ">
              <div>
                <span>Tipo {tipo}</span>
                <span> Clase {clase}</span>
              </div>
              <div>
                Dimensiones:
                <strong> {dimensiones.ancho} cm x{" "}
                {dimensiones.largo} cm x {dimensiones.alto} cm
                </strong>
              </div>
              <div className="mt-2">{codigoBarras}</div>
              <div className="text-left text-[18px] font-bold text-gray-600">
                <p>{producto}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-end items-center justify-center fit-content">
            <QRCodeComponent value={qrCodeValue} size={200} variant="custom" />
            <div className="text-[18px] font-bold rotate-90 transform origin-center">
              {dimensiones.ancho}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-0 w-full p-1 mt-1">
          <div className="col justify-center fit-content">
            <h5 className="text-[12px]">Composición Textil Forro</h5>
            <h5 className="text-[12px]">Tapa: {tapa} </h5>
            <h5 className="text-[12px]">Banda: {banda} </h5>
            <h5 className="text-[12px]">Tapa Tela: {tela_tapa} </h5>
            <div className="p-1"></div>
            <h5 className="text-[12px]">Fibras Textiles</h5>
            <h5 className="text-[12px]">Aislante: {aislante}</h5>
            <h5 className="text-[12px]">Lámina Textil: {lamina_textil}</h5>
            <h5 className="text-[12px]">
              Número de resortes: {numero_resortes}
            </h5>
            <h5 className="text-[12px]">
              Peso Máximo Individual de Soporte: {peso_maximo_individual}
            </h5>

            <div className="p-1"></div>
            <h5 className="text-[13px]">Condiciones de Conservación</h5>
            <div className="flex flex-row gap-2 mt-2">
              <Image
                src={"/icons/do-not-wash (1).png"}
                alt="Icono lavado"
                width={32}
                height={32}
              />
              <Image
                src={"/icons/not-bleach.png"}
                alt="Icono lavado"
                width={32}
                height={32}
              />
              <Image
                src={"/icons/do-not-tumble-dry.png"}
                alt="Icono lavado"
                width={32}
                height={32}
              />
              <Image
                src={"/icons/no-iron.png"}
                alt="Icono lavado"
                width={32}
                height={32}
              />
              <Image
                src={"/icons/do-not-dry.png"}
                alt="Icono lavado"
                width={32}
                height={32}
              />
              <Image
                src={"/icons/do-not-wetclean.jpg"}
                alt="Icono lavado"
                width={35}
                height={42}
              />
            </div>
            {/* <h5 className="text-[18px] font-bold">
              Fecha: {new Date().toLocaleDateString("es-EC")}{" "}
            </h5> */}
          </div>
          <div className=" items-start justify-start fit-content">
            <h5 className="text-[12px]">Espuma Banda</h5>
            <h5 className="text-[12px]">{espuma_banda}</h5>
            <h5 className="text-[12px]">Espuma Tapa: </h5>
            <h5 className="text-[12px]">{espuma_tapa}</h5>

            <div className="p-1"></div>

            <h5 className="text-[12px]">Espuma y Material Soporte</h5>
            <h5 className="text-[12px]">{R1}</h5>
            <h5 className="text-[12px]">{R2}</h5>
            <h5 className="text-[12px]">{R3}</h5>
            <br />
            <br />
            <h5 className="text-[12px] font-bold">
              No desprender esta etiqueta del producto.
            </h5>
            <h5 className="text-[12px] font-bold">
              Hecho en Ecuador por Chaide y Chaide S.A.
            </h5>
            <h5 className="text-[18px] font-bold">Lote: {LOTE} </h5>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
