
export const environment = {
    production: true,
    
    nombreAplicacion: "APP_PRODUCTIVIDAD_WEB",
    //apiURL : '/proord/api',
    //apiURL : 'http://localhost:5400',
    apiURL : 'https://apps.chaide.com/proord/api',
    //apiURL : 'https://apps.chaide.com/proord2/api',
    //apiURLSAP : 'https://192.168.1.209:8020/APINotificacionSAP',
    apiURLSAP : 'https://apps.chaide.com/NOTSAP/api',
    //apiURLSAP : 'http://localhost:5401',

    apiMenuURL: "https://apps.chaide.com/seguridades", // URL de tu API de menús

    tituloSistema: 'SISTEMA INTEGRADO DE PRODUCTIVIDAD OPERACIONAL (SIPO)',
    
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
