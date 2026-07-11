FROM nginx:1.27-alpine

COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY Assets /usr/share/nginx/html/Assets
COPY css /usr/share/nginx/html/css
COPY pages /usr/share/nginx/html/pages
COPY progress /usr/share/nginx/html/progress
COPY script /usr/share/nginx/html/script
COPY prev_analytics.html /usr/share/nginx/html/prev_analytics.html

RUN cp /usr/share/nginx/html/pages/landing_page.html /usr/share/nginx/html/index.html

EXPOSE 80
