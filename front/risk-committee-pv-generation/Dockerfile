FROM node:20.19.5-alpine3.22

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start", "-p", "3000", "-H", "0.0.0.0"]