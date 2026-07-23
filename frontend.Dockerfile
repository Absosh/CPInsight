FROM node:22-alpine AS ai_frontend_build

WORKDIR /app
COPY package.json ./
RUN npm install
COPY src ./src
COPY pages/ai-coach.html ./pages/ai-coach.html
COPY Assets ./Assets
COPY vite.config.js ./
RUN npm run build:frontend

FROM nginx:1.27-alpine

COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY Assets /usr/share/nginx/html/Assets
COPY css /usr/share/nginx/html/css
COPY pages /usr/share/nginx/html/pages
COPY progress /usr/share/nginx/html/progress
COPY script /usr/share/nginx/html/script
COPY --from=ai_frontend_build /app/dist /usr/share/nginx/html

RUN cp /usr/share/nginx/html/pages/landing_page.html /usr/share/nginx/html/index.html

EXPOSE 80
