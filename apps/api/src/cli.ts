import { createApiServer } from './server';

const port = Number(process.env.PORT ?? 4000);
const server = createApiServer().listen(port, '127.0.0.1', () => {
  console.log(`Phoenix API listening on http://127.0.0.1:${port}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
