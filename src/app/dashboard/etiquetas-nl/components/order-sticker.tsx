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
};

export default function OrderStickerColchonesSimple({
  //order,
  codigoBarras,
  añosGarantia,
  tipo,
  clase,
  dimensiones,
  producto,
  empresa,
  className = "",
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
      className={`shadow-lg w-full h-full flex-1 border border-gray-300 ${className}`}
    >
      <CardContent className="p-1 w-full h-full">
        {/* Grilla principal - 2 filas x 2 columnas */}
        <div className="w-full">
          {/* Superior izquierda: QR pequeño y código de barras */}
          <div className="flex flex-row items-start justify-start space-y-2">
            <QRCodeComponent value={qrCodeValue} size={46} />
            <div className="text-sm font-bold tracking-wide break-all ml-2">
              {codigoBarras}
            </div>
          </div>
        </div>

        <br />

        <div className="grid grid-cols-2 gap-4 w-full">
          {/* Superior derecha: Logo y círculo de garantía */}
          <div className="flex flex-col items-center justify-center">
            <Image
              src={getLogoSrc()}
              alt={getLogoAlt()}
              width={300}
              height={300}
            />
          </div>
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center align-content-center">
              <span className="text-2xl font-bold">{ new Date().getMonth() + 1 }</span>
            </div>
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
            <br />

            <div className="flex flex-col justify-start text-sm ">
              <div>
                <strong>Tipo {tipo}</strong>
              </div>
              <div>
                <strong>Clase {clase}:</strong> Dos plazas y media
              </div>
              <div>
                <strong>Dimensiones:</strong> {dimensiones.ancho} cm x{" "}
                {dimensiones.largo} cm x {dimensiones.alto} cm
              </div>
              <div className="font-bold mt-2">{codigoBarras}</div>
              <div className="text-left text-[18px] font-bold text-gray-600">
                <p>{producto}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-end items-center justify-end fit-content">
            <QRCodeComponent value={qrCodeValue} size={200} variant="custom" />
            <div className="text-[18px] font-bold rotate-90 transform origin-center">
              {dimensiones.ancho}
            </div>
          </div>
        </div>

        <div className="text-right text-xs text-gray-600 mt-2">
          <p>Hecho en Ecuador por {empresa || "Chaide y Chaide S.A"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
