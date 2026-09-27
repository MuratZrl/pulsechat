import { NestFactory } from '@nestjs/core';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Railway's edge proxy terminates every request, so without this req.ip is
  // the proxy's address and the IP-keyed throttler shares one bucket across
  // all visitors. Trust exactly one hop: the client IP the edge appends to
  // X-Forwarded-For, not client-supplied entries further left.
  app.set('trust proxy', 1);

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
  // Only the one configured web origin (FRONTEND_URL), plus localhost when not
  // running in production. The former pulsechat-*.vercel.app pattern matched
  // any Vercel project with that name prefix, which anyone can create.
  const productionOrigin = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const allowLocalhost = process.env.NODE_ENV !== 'production';
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
        (allowLocalhost && localhostPattern.test(origin))
      ) {
        callback(null, true);
        return;
      }

      // An HttpException, not a bare Error: Nest's error handler turns the
      // latter into a 500.
      callback(new ForbiddenException(`Origin not allowed by CORS: ${origin}`));
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
