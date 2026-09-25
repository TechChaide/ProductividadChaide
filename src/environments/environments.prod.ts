
export const environment = {
    production: true,
    
    nombreAplicacion: "APP_PRODUCTIVIDAD_WEB",
    //apiURL : '/proord/api',
    apiURL : 'http://localhost:5400',
    //apiURL : 'https://apps.chaide.com/proord/api',
    //apiURL : 'https://apps.chaide.com/proord2/api',
    //apiURLSAP : 'https://192.168.1.209:8020/APINotificacionSAP',
    apiURLSAP : 'https://apps.chaide.com/NOTSAP/api',
    //apiURLSAP : 'http://localhost:5401',

    apiMenuURL: "https://apps.chaide.com/seguridades", // URL de tu API de menús
    apiURL_Guard : 'https://apps.chaide.com/seguridadesGuard',
    //apiURL_Guard : 'http://localhost:5400',

    // --- Integración Paros/Captura (proyecto muestreos_frontend) ---
    // apiURL_Guard (arriba) se reutiliza para login/auth de esta integración.
    apiSamplingBA: 'https://apps.chaide.com/samplingBA',
    apiScanner: 'https://apps.chaide.com/codesgr',

    tituloSistema: 'SISTEMA INTEGRADO DE PRODUCTIVIDAD OPERACIONAL (SIPO)',
    
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
