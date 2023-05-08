import { Body, Controller, Post, Res } from '@nestjs/common';
import { ChatService } from './chat.service';

import { Configuration, OpenAIApi } from 'openai';

import type { ChatRequestPayload } from './type';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  async completeChat(@Body() body: ChatRequestPayload, @Res() res) {
    const { apiKey, messages } = body;
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);

    const stream = await this.chatService.completeChat(openai, messages);

    res.set('Content-Type', 'application/octet-stream');
    res.set('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
  }
}
