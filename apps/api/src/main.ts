import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
