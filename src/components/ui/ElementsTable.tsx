import React, { useEffect, useState, useRef } from "react";
import { servicioService } from "@/services/servicio.service";

interface QRResponse {
  CODIGO: string;
  CIUDAD: string;
}

interface ElementsTableProps {
  qrResponse?: QRResponse | null;
  centro?: string;
  fert?: string;
  autoFetch?: boolean;
  onSelectionChange?: (selectedItems: any[]) => void;
}

export default function ElementsTable({ qrResponse, centro, fert, autoFetch = true, onSelectionChange }: ElementsTableProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editable, setEditable] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  
  // Usar ref para onSelectionChange para evitar ciclos infinitos
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const fetchData = async (f: string, c: string) => {
    if (!f || !c) return;
    setLoading(true);
    try {
      const res = await servicioService.getElementsByCentroAndFert(f, c);
      const data = Array.isArray(res?.data) ? res.data : [];
      setItems(data);

      // inicializar checks: marcar si HALB_N1N contiene 'PLASTICO'
      const initialChecks: Record<number, boolean> = {};
      data.forEach((it: any, idx: number) => {
        const mat = (it?.HALB_N1N || "").toString().toUpperCase();
        initialChecks[idx] = mat.includes("PLASTICO");
      });
      setChecked(initialChecks);
    } catch (e) {
      console.error("Error fetching elements:", e);
      setItems([]);
      setChecked({});
    } finally {
      setLoading(false);
    }
  };

  // cuando cambia qrResponse o props fert/centro
  useEffect(() => {
    if (qrResponse && qrResponse.CODIGO && qrResponse.CIUDAD) {
      fetchData(qrResponse.CODIGO, qrResponse.CIUDAD);
    } else if (autoFetch && fert && centro) {
      fetchData(fert, centro);
    }
  }, [qrResponse?.CODIGO, qrResponse?.CIUDAD, fert, centro, autoFetch]);

  const toggleRow = (idx: number) => {
    if (!editable) return;
    setChecked((prev) => {
      const newChecked = { ...prev, [idx]: !prev[idx] };
      // Notificamos al padre mediante useEffect que observa `checked`
      return newChecked;
    });
  };

  // Evitar que el componente hijo actualice el estado del padre directamente
  // durante el render/setState; en su lugar notificamos al padre desde un efecto
  useEffect(() => {
    if (!onSelectionChangeRef.current) return;
    const selected = items.filter((_: any, i: number) => !!checked[i]);
    onSelectionChangeRef.current(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, items]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 mb-1">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={editable} onChange={() => setEditable(!editable)} />
          <span>Editable</span>
        </label>
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded"
          onClick={() => {
            // recargar con los últimos valores (prioriza qrResponse)
            if (qrResponse && qrResponse.CODIGO && qrResponse.CIUDAD) fetchData(qrResponse.CODIGO, qrResponse.CIUDAD);
            else if (fert && centro) fetchData(fert, centro);
          }}
        >
          Recargar
        </button>
        {loading && <span className="text-sm text-gray-600">Cargando...</span>}
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Sel</th>
              <th className="p-2 text-left">Producto</th>
              <th className="p-2 text-left">Material</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-left">Unidades 1</th>
              <th className="p-2 text-left">Unidades 2</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay elementos para mostrar
                </td>
              </tr>
            ) : (
              items.map((it: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={!!checked[idx]}
                      disabled={!editable}
                      onChange={() => toggleRow(idx)}
                    />
                  </td>
                  <td className="p-2">{it?.FERT_D ?? ""}</td>
                  <td className="p-2">{it?.HALB_N1N ?? ""}</td>
                  <td className="p-2 text-right">{(Number(it?.CantidadItem ?? 0)).toFixed(3)}</td>
                  <td className="p-2">{it?.HALB_N1_Unidad ?? ""}</td>
                  <td className="p-2">{it?.HALB_N2_Unidad ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
