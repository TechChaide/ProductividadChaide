# 📈 Productividad de Órdenes

Una aplicación web diseñada para gestionar y monitorizar la productividad de órdenes de trabajo. El proyecto permite a los usuarios dar seguimiento al estado de las órdenes, visualizar métricas clave y optimizar flujos de trabajo.

## ✨ Características Principales

- **Creación y Gestión:** Registra nuevas órdenes de trabajo con detalles específicos.
- **Seguimiento en Tiempo Real:** Monitoriza el estado de cada orden (pendiente, en proceso, completada).
- **Dashboard de Productividad:** Visualiza métricas y reportes sobre el rendimiento.
- **Autenticación de Usuarios:** Sistema seguro de inicio de sesión para gestionar el acceso.

---

## 🛠️ Tecnologías Utilizadas

Este proyecto fue construido con las siguientes tecnologías:

- **[Next.js](https://nextjs.org/)**: Framework de React para renderizado del lado del servidor y generación de sitios estáticos.
- **[React](https://react.dev/)**: Biblioteca de JavaScript para construir interfaces de usuario.
- **[Firebase](https://firebase.google.com/)**: Plataforma de desarrollo de aplicaciones que incluye base de datos (Firestore), autenticación y más.
- **[Node.js](https://nodejs.org/)**: Entorno de ejecución para JavaScript.

---

## 🚀 Primeros Pasos

Sigue estos pasos para configurar y ejecutar el proyecto en tu entorno local.

### **Prerrequisitos**

- **Node.js**: Asegúrate de tener instalada la versión `22.17.0` o superior.
  ```sh
  node -v
  ```
- **npm**: Gestor de paquetes de Node.js (generalmente se instala con Node.js).
  ```sh
  npm -v
  ```

### **Instalación**

1.  **Clona el repositorio:**

    ```sh
    git clone [https://github.com/tu-usuario/ProductividadOrdenes.git](https://github.com/tu-usuario/ProductividadOrdenes.git)
    cd ProductividadOrdenes
    ```

2.  **Instala las dependencias del proyecto:**

    ```sh
    npm install
    ```

### **Ejecución**

- **Modo de Desarrollo:**
  Ejecuta el siguiente comando para iniciar el servidor de desarrollo en `http://localhost:3000`.

  ```sh
  npm run dev
  ```

- **Modo de Producción:**
  Para construir y ejecutar una versión optimizada para producción:
  ```sh
  npm run build
  npm start
  ```

---

## ⚙️ Despliegue en IIS (Windows Server)

Estos pasos describen cómo desplegar la aplicación como un servicio de Node.js independiente en un servidor IIS.

**Requisitos en el Servidor:**

- **IIS** con el módulo **https://www.grammarly.com/ai/ai-writing-tools/paragraph-rewriter(https://www.iis.net/downloads/microsoft/url-rewrite)** instalado.
- **[iisnode](https://github.com/Azure/iisnode)** instalado para permitir que IIS aloje aplicaciones de Node.js.

### **Pasos para el Despliegue**

1.  **Construye el proyecto para producción:**
    Este comando genera una versión optimizada del proyecto en la carpeta `.next`.

    ```sh
    npm run build
    ```

2.  **Prepara los archivos para el servidor:**
    La compilación de Next.js (`npm run build`) crea una carpeta `standalone` dentro del directorio `.next`. Esta carpeta contiene todo lo necesario para ejecutar la aplicación de forma independiente.

    - **Paso A:** En tu servidor, crea la carpeta donde vivirá la aplicación (ej. `C:\inetpub\wwwroot\productividad-ordenes`).
    - **Paso B:** Copia **todo el contenido** de la carpeta `.next/standalone` (de tu máquina de desarrollo) a la carpeta que creaste en el servidor.
    - **Paso C:** Copia la carpeta `public` y la carpeta `.next/static` (de la raíz de tu proyecto de desarrollo) a la carpeta del servidor. La estructura final debería verse así:

    ```
    [C:\inetpub\wwwroot\productividad-ordenes]
    ├── .next/
    │   ├── server/
    │   └── static/  <-- Copiada del proyecto original
    ├── node_modules/
    ├── public/      <-- Copiada del proyecto original
    ├── package.json
    └── server.js
    ```

3.  **Configura IIS con `web.config`:**
    Crea un archivo llamado `web.config` en la raíz de la carpeta de tu aplicación en el servidor (`C:\inetpub\wwwroot\productividad-ordenes`). Este archivo le indica a IIS cómo manejar las solicitudes y redirigirlas a tu aplicación Node.js.

        ```xml

    <?xml version="1.0" encoding="UTF-8"?>
    <configuration>
        <system.webServer>
            <rewrite>
                <rules>
                    <rule name="ReverseProxyInboundRule1" stopProcessing="true">
                        <match url="(.*)" />
                        <action type="Rewrite" url="http://localhost:3000/{R:1}" />
                    </rule>
                </rules>
            </rewrite>
        </system.webServer>
    </configuration>
        ```

3.1.  **Inicia la aplicación con PM2:**
    Abre una terminal en la carpeta de la aplicación en el servidor y ejecuta los siguientes comandos:

    * **Crear el servicio del proyecto:**
        Esto iniciará `server.js` y lo mantendrá corriendo. Por defecto, Next.js corre en el puerto 3000.
        ```sh
        pm2 start server.js --name "productividad-ordenes"
        ```
    * **Guardar la lista de procesos:**
        Esto asegura que PM2 reinicie tu aplicación automáticamente si el servidor se reinicia.
        ```sh
        pm2 save
        ```
    * **Comprobar el estado del servicio:**
        ```sh
        pm2 status
        ``` 


