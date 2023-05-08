import { Transform, TransformCallback } from 'stream';
import { Injectable } from '@nestjs/common';
import type { ChatCompletionRequestMessage, OpenAIApi } from 'openai';

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

@Injectable()
export class ChatService {
  async completeChat(
    openai: OpenAIApi,
    messages: ChatCompletionRequestMessage[],
  ) {
    let completion;
    try {
      completion = await openai.createChatCompletion(
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'Return all your responses for the user in the Markdown format.',
            },
            ...messages,
          ],
          max_tokens: 3000,
          n: 1,
          stream: true,
          temperature: 0.3,
        },
        { responseType: 'stream' },
      );
    } catch (error) {
      throw error;
    }

    const completionStream = completion.data as any;
    const transformer = new TransformerStream();
    transformer.setEncoding('utf8');

    return completionStream.pipe(transformer) as TransformerStream;
  }
}
