import { Body, Controller, Post, Res } from '@nestjs/common';
import { ChatService } from './chat.service';

import { Configuration, OpenAIApi } from 'openai';

import { InvalidApiKeyError } from 'src/Errors';

import type { ChatRequestPayload } from './type';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  async completeChat(@Body() body: ChatRequestPayload, @Res() res) {
    const { apiKey, context, messages } = body;

    if (
      this.chatService.assessTokenCount({
        messages: [messages[messages.length - 1]],
      }) > 800
    ) {
      return res.status(400).json({
        errorCode: 1,
        message:
          'Your last message is too long, try to make it shorter(around 600 words).',
      });
    }

    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);
    let newContext;

    const tokenCount = this.chatService.assessTokenCount({ context, messages });

    try {
      // Maximum allowed history token count is 1000, but due to the inaccuracy of the token count estimation
      // We use 0.9 of the maximum token count
      if (tokenCount > 900) {
        newContext = await this.chatService.summarizeContext(openai, {
          context,
          messages: messages.slice(0, messages.length - 1),
        });
      }

      const stream = await this.chatService.completeChat(openai, {
        context: newContext || context,
        messages: newContext ? [messages[messages.length - 1]] : messages,
      });

      res.set('Content-Type', 'application/octet-stream');
      res.set('X-Content-Type-Options', 'nosniff');
      stream.pipe(res);
      if (newContext) {
        stream.push(
          `-----Context Start-----${newContext}-----Context End-----`,
        );
      }
    } catch (error) {
      if (error instanceof InvalidApiKeyError) {
        res.status(401).json({ errorCode: 2, message: error.message });
      } else {
        res
          .status(500)
          .json({ errorCode: 99999, message: 'Internal Server Error.' });
      }
    }
  }
}
