import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Wire the socket.io Redis adapter BEFORE app.listen so the gateway boots
  // with cross-replica pub/sub instead of the in-memory default.
  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  // Quit the dedicated pub/sub clients on shutdown. RedisService cleans up its
  // own client via OnModuleDestroy; this hook covers the adapter's pair.
  process.on('SIGTERM', () => {
    void ioAdapter.disconnect();
  });

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CORS — allow frontend
  //
  // Accept the configured production origin AND any Vercel preview deploy.
  // Vercel mints a new subdomain per branch (e.g. pulsechat-git-fix-foo-...
  // .vercel.app), so a hardcoded list can't cover them. Locked to project
  // subdomains via regex so unrelated *.vercel.app sites can't hit us.
  const productionOrigin = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const previewPattern = /^https:\/\/pulsechat-[a-z0-9-]+\.vercel\.app$/;
  const localhostPattern = /^http:\/\/localhost:\d+$/;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: CorsOriginCallback,
    ): void => {
      // Same-origin / non-browser requests (curl, Postman, server-to-server)
      // arrive with no Origin header — allow them through.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        origin === productionOrigin ||
        previewPattern.test(origin) ||
        localhostPattern.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API listening on port ${port}`);
}
bootstrap();
