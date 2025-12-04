# === Etapa 1: Builder - Instala dependencias y construye la aplicación ===
FROM node:20-alpine AS builder

# Establece el directorio de trabajo
WORKDIR /app

# Instala dependencias del sistema necesarias para canvas y otras librerías nativas
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copia los archivos de definición de paquetes
COPY package*.json ./

# Instala las dependencias de producción
RUN npm install

# Copia el resto del código fuente de la aplicación
COPY . .

# Construye la aplicación Next.js para producción
# La configuración 'output: standalone' en next.config.js es crucial aquí
RUN npm run build

# === Etapa 2: Runner - Crea la imagen final de producción ===
FROM node:20-alpine AS runner

WORKDIR /app

# Instala las dependencias de runtime necesarias para canvas
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

# Crea un usuario no-root para mejorar la seguridad
RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs

# Copia los artefactos de la construcción desde la etapa 'builder'
# Copia la carpeta 'public' para que las imágenes y otros assets funcionen
COPY --from=builder /app/public ./public
# Copia la salida 'standalone' que contiene el servidor optimizado y el código necesario
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Establece el usuario no-root para ejecutar la aplicación
USER nextjs

# Expone el puerto en el que la aplicación se ejecutará
# Tu docker-compose.override.yml ya mapea el puerto 3000 de Traefik a este contenedor
EXPOSE 3000

# Define el comando para iniciar el servidor de Next.js
# El servidor 'server.js' es generado por la construcción 'standalone'
CMD ["node", "server.js"]