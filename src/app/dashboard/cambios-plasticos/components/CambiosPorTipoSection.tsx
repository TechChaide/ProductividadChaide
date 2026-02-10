'use client';

import React from 'react';
import type { CambioPorTipo } from '@/types/interfaces';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, Legend } from 'recharts';

interface CambiosPorTipoSectionProps {
  data: CambioPorTipo[];
}

const COLORS = ['#3b82f6', '#ec4899'];

export default function CambiosPorTipoSection({ data }: CambiosPorTipoSectionProps) {
  // Calcular porcentaje total
  const totalCantidad = data.reduce((sum, item) => sum + item.cantidad, 0);
  
  const dataConPorcentaje = data.map(item => ({
    ...item,
    porcentaje: ((item.cantidad / totalCantidad) * 100).toFixed(1),
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">
        CAMBIOS POR TIPO
      </h3>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={dataConPorcentaje}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="tipo_cambio" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value, name) => {
              if (name === 'cantidad') return [`${value} KG`, 'Cantidad'];
              return value;
            }}
          />
          <Bar dataKey="cantidad" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Cantidad (KG)">
            {dataConPorcentaje.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detalle */}
      <div className="mt-6 space-y-3">
        {dataConPorcentaje.map((item, index) => (
          <div key={item.tipo_cambio} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <div>
                <p className="font-medium text-gray-900">{item.tipo_cambio}</p>
                <p className="text-xs text-gray-600">{item.Unidades}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">{item.cantidad}</p>
              <p className="text-xs text-gray-600">{item.porcentaje}%</p>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Total</span>
          <span className="text-lg font-bold text-gray-900">{totalCantidad.toFixed(2)} KG</span>
        </div>
      </div>
    </div>
  );
}
