import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// How to generate these files HTTPS certificate
// https://stackoverflow.com/questions/22584268/node-js-https-pem-error-routinespem-read-biono-start-line/24283204#24283204
const httpsOptions = {
  key: fs.readFileSync('./secrets/key.pem'),
  cert: fs.readFileSync('./secrets/server.crt'),
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { httpsOptions });
  await app.listen(process.env.PORT);
}
bootstrap();
