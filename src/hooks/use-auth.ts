'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { environment } from '@/environments/environments.prod';

interface AuthData {
  codigo: string;
  nombre: string;
  departamento: string;
  localidad: string;
  turno: string;
  grupo_departamento: string;
  is_produccion: boolean;
}

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  authData: AuthData | null;
  logout: () => void;
  refreshActivity: () => void;
}

const SESSION_TIMEOUT = 660 * 60 * 1000; // 15 minutos en milisegundos
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Verificar cada minuto

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const router = useRouter();

  // Función para cerrar sesión
  const logout = useCallback(() => {
    // Limpiar sessionStorage
    sessionStorage.removeItem('usuario_codigo');
    sessionStorage.removeItem('usuario_nombre');
    sessionStorage.removeItem('usuario_departamento');
    sessionStorage.removeItem('usuario_localidad');
    sessionStorage.removeItem('usuario_turno');
    sessionStorage.removeItem('usuario_grupo_departamento');
  sessionStorage.removeItem('usuario_es_produccion');
    sessionStorage.removeItem('lastActivity');
    
    // Actualizar estados
    setIsAuthenticated(false);
    setAuthData(null);
    
    // Redirigir al login
    //router.push(`${environment.basePath}/`);
    router.push(`/`);
  }, [router]);

  // Función para actualizar la actividad del usuario
  const refreshActivity = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastActivity', Date.now().toString());
    }
  }, []);

  // Verificar autenticación y datos de sesión
  const checkAuth = useCallback(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    const codigo = sessionStorage.getItem('usuario_codigo');
    const nombre = sessionStorage.getItem('usuario_nombre');
    const departamento = sessionStorage.getItem('usuario_departamento');
    const localidad = sessionStorage.getItem('usuario_localidad');
    const turno = sessionStorage.getItem('usuario_turno');
    const grupo_departamento = sessionStorage.getItem('usuario_grupo_departamento');
    const lastActivity = sessionStorage.getItem('lastActivity');

    // Verificar que existan los datos básicos necesarios
    if (!codigo || !nombre) {
      logout();
      return;
    }

    // Verificar timeout de sesión
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        console.log('Sesión expirada por inactividad');
        logout();
        return;
      }
    } else {
      // Si no hay registro de actividad, establecer uno ahora
      refreshActivity();
    }

    // Si llegamos aquí, la autenticación es válida
    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isProduccion = (() => {
      const dep = normalize(departamento || '');
      const grupo = normalize(grupo_departamento || '');
      return dep.includes('produccion') || grupo.includes('produccion');
    })();

    // Guardar bandera en sesión para uso global
    sessionStorage.setItem('usuario_es_produccion', isProduccion ? 'true' : 'false');

    setAuthData({
      codigo: codigo,
      nombre: nombre,
      departamento: departamento || '',
      localidad: localidad || '',
      turno: turno || 'diurno',
      grupo_departamento: grupo_departamento || '',
      is_produccion: isProduccion
    });
    
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [logout, refreshActivity]);

  // Verificar autenticación al montar el componente
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Configurar verificación periódica de la sesión
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
          console.log('Sesión expirada por inactividad - verificación periódica');
          logout();
        }
      }
    }, ACTIVITY_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  // Escuchar eventos de actividad del usuario para actualizar timestamp
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      refreshActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [isAuthenticated, refreshActivity]);

  return {
    isAuthenticated,
    isLoading,
    authData,
    logout,
    refreshActivity
  };
}

// Devuelve los datos del usuario autenticado desde sessionStorage (solo en cliente)
export function getUserDataFromSession(): {
  CODIGO: string;
  DEPARTAMENTO: string;
  GRUPO_DEPARTAMENTO: string;
  LOCALIDAD: string;
  NOMBRE: string;
} | null {
  if (typeof window === 'undefined') return null;
  const CODIGO = sessionStorage.getItem('usuario_codigo') || '';
  const DEPARTAMENTO = sessionStorage.getItem('usuario_departamento') || '';
  const GRUPO_DEPARTAMENTO = sessionStorage.getItem('usuario_grupo_departamento') || '';
  const LOCALIDAD = sessionStorage.getItem('usuario_localidad') || '';
  const NOMBRE = sessionStorage.getItem('usuario_nombre') || '';
  if (!CODIGO || !NOMBRE) return null;
  return { CODIGO, DEPARTAMENTO, GRUPO_DEPARTAMENTO, LOCALIDAD, NOMBRE };
}