import { Module } from '@nestjs/common';
import { HomeController } from './home/home.controller';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';

@Module({
  controllers: [HomeController, ChatController],
  providers: [ChatService],
})
export class AppModule {}
