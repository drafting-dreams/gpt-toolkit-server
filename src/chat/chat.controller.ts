import { Body, Controller, Post, Res } from '@nestjs/common';
import { ChatService } from './chat.service';

import { Configuration, OpenAIApi } from 'openai';

import type { ChatRequestPayload } from './type';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  async completeChat(@Body() body: ChatRequestPayload, @Res() res) {
    const { apiKey, context, messages } = body;
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);
    let newContext;

    const tokenCount = this.chatService.assessTokenCount({ context, messages });
    // Maximum allowed history token count is 1000, but due to the inaccuracy of the token count estimation
    // We use 0.9 of the maximum token count
    if (tokenCount > 900) {
      newContext = this.chatService.summarizeContext(openai, {
        context,
        messages: messages.slice(0, messages.length - 1),
      });
    }

    const stream = await this.chatService.completeChat(openai, {
      context: newContext,
      messages: newContext ? messages.slice(0, messages.length - 1) : messages,
    });

    res.set('Content-Type', 'application/octet-stream');
    res.set('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
    if (newContext) {
      stream.push(
        `-----Context Start-----
${newContext}
-----Context End-----`,
      );
    }
  }
}
