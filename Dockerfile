FROM node:lts-alpine3.22

LABEL org.opencontainers.image.source=https://github.com/sempasha/super-dns-lookup/Dockerfile
LABEL org.opencontainers.image.description="NodeJS image for super-dns-lookup development purpose"
LABEL org.opencontainers.image.licenses=MIT

RUN apk add --no-cache git zsh
USER node
RUN sh -c "$(wget https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh -q -O -)"

SHELL ["zsh", "-c"]