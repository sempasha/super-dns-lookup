FROM node:24-bookworm-slim

LABEL org.opencontainers.image.source=https://github.com/sempasha/super-dns-lookup/Dockerfile
LABEL org.opencontainers.image.description="NodeJS image for super-dns-lookup development purpose"
LABEL org.opencontainers.image.licenses=MIT

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git wget zsh \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*
USER node
RUN sh -c "$(wget https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh -q -O -)"

SHELL ["zsh", "-c"]