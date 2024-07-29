import { Hono } from 'hono';
import { handle } from 'hono/lambda-edge';

const app = new Hono();

app.get('/', (c) => c.text('Hey from secure endpoint!'));

export const handler = handle(app);