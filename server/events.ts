/**
 * Server-sent events: tells every open browser which collection changed so screens refresh
 * (the browser dev backend does the same between tabs with the `storage` event).
 */
import type { Request, Response } from 'express';

const clients = new Set<Response>();

export function eventsHandler(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Ask buffering reverse proxies to stream the response.
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcast(collection: string) {
  const msg = `data: ${JSON.stringify({ c: collection })}\n\n`;
  for (const res of clients) res.write(msg);
}
