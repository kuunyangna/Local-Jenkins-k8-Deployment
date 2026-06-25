FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY index.html /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
