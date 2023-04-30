import { Transform, TransformCallback } from 'stream';
import { Body, Controller, Post, Res } from '@nestjs/common';
import { Configuration, OpenAIApi } from 'openai';
import { ChatRequestPayload } from './type';

@Controller('chat')
export class ChatController {
  @Post()
  async completeChat(@Body() body: ChatRequestPayload, @Res() res) {
    const { apiKey, messages } = body;
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);
    const completion = await openai.createChatCompletion(
      {
        model: 'gpt-3.5-turbo',
        messages: messages,
        n: 1,
        stream: true,
        max_tokens: 4000,
      },
      { responseType: 'stream' },
    );

    class TransformerStream extends Transform {
      _transform(
        chunk: any,
        encoding: BufferEncoding,
        callback: TransformCallback,
      ): void {
        // Remove 'data: ' at the start of the stream
        const choices = (chunk.toString().substring(6) as string)
          .split('\n\ndata: ')
          // Remove \n at the end of a message
          .map((data) => data.trim())
          // Remove empty strings and the last useless [DONE] message
          .filter((data) => data.length && data !== '[DONE]')
          .map((data) => JSON.parse(data).choices[0]);
        choices.forEach((choice) => {
          if (choice.delta.content) {
            this.push(choice.delta.content, 'utf8');
          }
        });
        callback();
      }
    }

    const transformer = new TransformerStream();
    transformer.setEncoding('utf8');

    const completionStream = completion.data as any;
    res.set('Content-Type', 'application/octet-stream');
    res.set('X-Content-Type-Options', 'nosniff');
    completionStream.pipe(transformer).pipe(res);
  }
}
