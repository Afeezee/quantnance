import express, { type Request, type Response } from 'express';
import path from 'node:path';

const app = express();
const PORT = process.env.PORT || 3000;
const clientDistDir = path.resolve(__dirname, '../client/dist');

// Middleware setup
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

app.use(express.static(clientDistDir));

app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});