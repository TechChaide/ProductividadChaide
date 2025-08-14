# --- Etapa 1: Instalación de dependencias (Sin cambios) ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# --- Etapa 2: Construcción de la aplicación (Sin cambios) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Etapa 3: Imagen final de producción (Estructura Simplificada) ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Crea un usuario y grupo sin privilegios para mayor seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# --- ¡ESTAS SON LAS LÍNEAS CLAVE CORREGIDAS! ---
# Copia el contenido de la carpeta 'standalone' directamente a la raíz de /app
# Esto incluye server.js, node_modules y una carpeta .next con los archivos del servidor.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copia las carpetas 'public' y 'static' a sus ubicaciones correctas,
# relativas a la raíz de la app, donde el servidor las espera.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Establece el usuario sin privilegios para ejecutar la aplicación
USER nextjs

# Expone el puerto que la aplicación usará
EXPOSE 3000
ENV PORT 3000

# El comando para iniciar el servidor de Node.
# Ahora server.js está en la raíz de /app.
CMD ["node", "server.js"]
