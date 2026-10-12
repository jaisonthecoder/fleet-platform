# Serves the Vite build and forwards /api to the API container, which runs as a sidecar
# in the same App Service. dist/ is produced by the pipeline before this image is built;
# see .azuredevops/azure-pipelines-uat.yml in the parent repository.
FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 8080
