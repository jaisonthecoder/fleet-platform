# Runtime image only. The build context is the pipeline's staged `pnpm deploy --prod`
# output (dist, node_modules and the generated Prisma client), not this repository.
# See .azuredevops/azure-pipelines-uat.yml in the parent repository.
#
# Debian rather than Alpine: native modules (argon2, Prisma) are resolved on the glibc
# build agent and must run against the same libc.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app
COPY --chown=node:node . .

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
