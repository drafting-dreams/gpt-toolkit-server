import { Transform, TransformCallback } from 'stream';
import { Injectable } from '@nestjs/common';
import { InvalidApiKeyError } from 'src/Errors';
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
    {
      context,
      messages,
    }: { context?: string; messages: ChatCompletionRequestMessage[] },
  ) {
    const basePrompt =
      "You're an intelligent AI that will have a dialog with the user. \
      If they say something you don't know how to reply. Analyse if that's something you know, if it is, explain it. \
      Your response should be the same language as the user's latest message.";
    const prompt = `${basePrompt} Return all your responses for the user in the Markdown format.`;
    const promptWithContext = `${basePrompt}\nHere's a context about what you and the user have discussed delimited by five backticks.\
      \`\`\`\`\`${context}\`\`\`\`\`\
      You should process the following dialog base on the context above as a background knowledge.\
      Most importantly all your responses should be in the Markdown format.`;
    let completion;
    try {
      completion = await openai.createChatCompletion(
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: context ? promptWithContext : prompt,
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
      if (error.response?.status === 401) {
        throw new InvalidApiKeyError();
      } else {
        throw error;
      }
    }

    const completionStream = completion.data as any;
    const transformer = new TransformerStream();
    transformer.setEncoding('utf8');

    return completionStream.pipe(transformer) as TransformerStream;
  }

  assessTokenCount({
    context,
    messages,
  }: {
    context?: string;
    messages: ChatCompletionRequestMessage[];
  }) {
    let characterCount = 0,
      wordCount = 0;
    if (context) {
      wordCount = context.split(' ').length;
      characterCount = context.length;
    }

    messages.forEach((message) => {
      wordCount += message.content.split(' ').length;
      characterCount += message.content.length;
    });

    return (characterCount / 4 + (wordCount / 3) * 4) / 2;
  }

  async summarizeContext(
    openai: OpenAIApi,
    {
      context,
      messages,
    }: { context?: string; messages: ChatCompletionRequestMessage[] },
  ) {
    let completion;
    const prompt = `You're gonna receive a chat history between you and me in JSON format which will be delimited by five backticks. \
    Your task is to summarize the dialogue within 100 words. \
    \`\`\`\`\`${JSON.stringify(messages)}\`\`\`\`\``;
    const promptWithLastContext = `You're gonna receive a JSON that includes "context" and "dialog" fields. The JSON will be delimited by five backticks.\
    The "context" is a summary of a dialog between you and me. \
    And the "dialog" is an array of messages that continued after the "context". \
    Your need to analyse if the "dialog" is relevant to the "context" first.
      - If it is, your task will be to summarize the dialog based on the "context" within 100 words.
      - If it's not, you can ignore the "context" and only summarize the dialog within 100 words.
    \`\`\`\`\`${JSON.stringify({ context, messages })}\`\`\`\`\``;

    try {
      completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: context ? promptWithLastContext : prompt,
          },
        ],
        max_tokens: 600,
        n: 1,
        temperature: 0,
      });
    } catch (error) {
      if (error.response?.status === 401) {
        throw new InvalidApiKeyError();
      } else {
        throw error;
      }
    }

    return completion.data.choices[0].message.content;
  }
}
