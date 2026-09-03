FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# دیتابیس و آپلودها روی این مسیرها با volume نگه‌داری می‌شوند
# تا با هر بازسازی ایمیج از بین نروند.
ENV DB_DIR=/app/data
RUN mkdir -p /app/data /app/uploads

EXPOSE 4000

CMD ["node", "server.js"]
