import type { FastifyReply } from 'fastify';

export function setupSse(reply: FastifyReply) {
  reply.hijack();
  reply.raw.statusCode = 200;
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders();
  reply.raw.socket?.setKeepAlive(true);
  reply.raw.socket?.setNoDelay(true);
  reply.raw.write(': connected\n\n');
}
