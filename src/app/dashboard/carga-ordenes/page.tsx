"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CargaOrdenesContent from "./components/carga-ordenes-content";

export default function CargaOrdenesPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Carga de Órdenes para remplazo de Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Carga de órdenes de producción.</p>
        </CardContent>
      </Card>

      <CargaOrdenesContent />
    </div>
  );
}
