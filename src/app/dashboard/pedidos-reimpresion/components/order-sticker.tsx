import React from "react";
import Barcode from "@/components/ui/barcode";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import type { Order, OrderAlmohadas } from "@/types/order";

type Props = {
  order: OrderAlmohadas & { codigo_barras?: string };
  codigoBarras?: string;
  className?: string;
};

export default function OrderSticker({ order, codigoBarras, className = "" }: Props) {
  if (!order) return null;
  const barcodeValue = codigoBarras || 'No definido';
  return (
    <Card className={`shadow-lg w-full h-full flex-1 border border-gray-300 ${className}`}>
      <CardContent className="p-4 flex flex-col items-center justify-center w-full h-full">
        <div className="w-full flex flex-col gap-0.5 text-xs font-mono text-gray-700 items-end">
          <div className="flex flex-row gap-2 w-full justify-end">
            <span className="text-right">ORDEN:</span>
            <span className="text-right">{order.orden}</span>
          </div>
          <div className="flex flex-row gap-2 w-full justify-end">
            <span className="text-right">PAQ:</span>
            <span className="text-right">{order.paquete}</span>
          </div>
        </div>
        <span className="text-4xl font-bold leading-none tracking-tight text-black">{order.cantProgramada}</span>
        <span className="text-[11px] font-semibold text-gray-700 ">UNIDAD: UNIDADES</span>
        <span className="text-[8px] text-gray-700 mb-2">{order.descripcionMaterial}</span>
        <div className="w-full flex flex-col items-center">
          <Barcode value={barcodeValue} width={260} height={46} />
          <span className="text-[11px] font-mono  text-gray-500">{barcodeValue}</span>
        </div>
        <div className="w-full flex flex-col items-center justify-center mt-1">
          <span className="text-[8px] text-gray-500">FABRICADO POR</span>
          <Image src="/img/chaide.png" alt="Logo Chaide" width={100} height={32} />
        </div>
      </CardContent>
    </Card>
  );
}
