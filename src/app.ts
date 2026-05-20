import express, { type Request, type Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());

// Sample route
app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to the Quantnance application!');
});

// Additional routes can be defined here

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});