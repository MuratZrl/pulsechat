import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule], // R2Service — signed attachment URLs
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
