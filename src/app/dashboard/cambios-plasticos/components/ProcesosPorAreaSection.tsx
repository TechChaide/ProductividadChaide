'use client';

import React, { useState, useEffect } from 'react';
import type { CambioPorSolicitante } from '@/types/interfaces';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { authService } from '@/services/authService';
import { ChevronDown } from 'lucide-react';

interface ProcesosPorAreaSectionProps {
  data: CambioPorSolicitante[];
}

interface SolicitanteConDepartamento extends CambioPorSolicitante {
  departamento: string;
  nombre?: string;
}

interface DepartamentoAgrupado {
  nombre: string;
  total_ordenes: number;
  solicitantes: SolicitanteConDepartamento[];
}

export default function ProcesosPorAreaSection({
  data,
}: ProcesosPorAreaSectionProps) {
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [departamentos, setDepartamentos] = useState<DepartamentoAgrupado[]>([]);
  const [loading, setLoading] = useState(true);

  // Obtener departamentos y agrupar por ellos
  useEffect(() => {
    const obtenerYAgruparDepartamentos = async () => {
      try {
        setLoading(true);
        
        // Llamar a loginColaborador para cada solicitante
        const solicitantesConDepts = await Promise.all(
          data.map(async (item) => {
            try {
              const response = await authService.loginColaborador(item.solicitante);
              const departamento = response.user?.ficha?.DEPARTAMENTO || 'Sin Departamento';
              const nombre = response.user?.ficha?.NOMBRE || 'Sin Nombre';
              
              return {
                ...item,
                departamento,
                nombre,
              };
            } catch (error) {
              console.warn(`Error obteniendo departamento para ${item.solicitante}:`, error);
              return {
                ...item,
                departamento: 'Sin Departamento',
                nombre: 'Sin Nombre',
              };
            }
          })
        );

        // Agrupar por departamento
        const agrupado = solicitantesConDepts.reduce((acc, item) => {
          const deptExistente = acc.find(d => d.nombre === item.departamento);
          
          if (deptExistente) {
            deptExistente.solicitantes.push(item);
            deptExistente.total_ordenes += item.total_ordenes;
          } else {
            acc.push({
              nombre: item.departamento,
              total_ordenes: item.total_ordenes,
              solicitantes: [item],
            });
          }
          
          return acc;
        }, [] as DepartamentoAgrupado[]);

        // Ordenar por total de órdenes descendente
        const deptOrdenados = agrupado.sort(
          (a, b) => b.total_ordenes - a.total_ordenes
        );

        setDepartamentos(deptOrdenados);
      } finally {
        setLoading(false);
      }
    };

    if (data.length > 0) {
      obtenerYAgruparDepartamentos();
    }
  }, [data]);

  const totalOrdenes = departamentos.reduce((sum, dept) => sum + dept.total_ordenes, 0);

  // Si aún está cargando, mostrar spinner
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
            <p className="text-gray-600 text-sm">Cargando departamentos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            PROCESOS POR ÁREA SOLICITANTE
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Distribución de cambios por departamento solicitante
          </p>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div className="mb-8">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={departamentos}
            margin={{ top: 20, right: 30, left: 0, bottom: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="nombre"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={120}
              interval={0}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              label={{ value: 'Órdenes', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value) => [`${value} órdenes`, 'Total']}
              labelStyle={{ color: '#000' }}
            />
            <Bar 
              dataKey="total_ordenes" 
              fill="#3b82f6" 
              radius={[8, 8, 0, 0]}
              name="Órdenes"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cards por departamento */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Detalle por Departamento
        </h3>

        {departamentos.map((dept) => {
          const percentage = ((dept.total_ordenes / totalOrdenes) * 100).toFixed(1);
          const isExpanded = expandedDept === dept.nombre;

          return (
            <div
              key={dept.nombre}
              className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
            >
              {/* Header del card */}
              <button
                onClick={() =>
                  setExpandedDept(isExpanded ? null : dept.nombre)
                }
                className="w-full px-4 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900 text-sm uppercase">
                    {dept.nombre}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {dept.solicitantes.length} solicitante{dept.solicitantes.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {dept.total_ordenes}
                    </p>
                    <p className="text-xs text-gray-600">{percentage}%</p>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Barra de progreso */}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(dept.total_ordenes / Math.max(...departamentos.map((d) => d.total_ordenes))) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Contenido expandible - Solicitantes */}
              {isExpanded && (
                <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 space-y-3">
                  {dept.solicitantes
                    .sort((a, b) => b.total_ordenes - a.total_ordenes)
                    .map((solicitante) => {
                      const solicitantePercentage = (
                        (solicitante.total_ordenes / dept.total_ordenes) *
                        100
                      ).toFixed(1);

                      return (
                        <div
                          key={solicitante.solicitante}
                          className="bg-white p-3 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {solicitante.nombre}
                              </p>
                              <p className="text-xs text-gray-500">
                                Código: {solicitante.solicitante}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-blue-600">
                              {solicitante.total_ordenes} órdenes
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full"
                              style={{
                                width: `${(solicitante.total_ordenes / dept.total_ordenes) * 100}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {solicitantePercentage}% del departamento
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Total de Órdenes
          </span>
          <span className="text-lg font-bold text-gray-900">
            {totalOrdenes}
          </span>
        </div>
      </div>
    </div>
  );
}
