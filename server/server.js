import 'dotenv/config'; // must be first: loads .env before anything else reads process.env
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes.js';
import authRoutes from './authRoutes.js';

// Fail fast: a missing secret would make every token forgeable, so refuse to start instead.
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing in .env');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json()); 
// ORDER MATTERS: /api/auth (public) is mounted BEFORE /api (protected), otherwise login itself would demand a token.
app.use('/api/auth', authRoutes);
app.use('/api', routes);

app.use((err, _req, res, _next) => res.status(err.status || (err.name === 'CastError' ? 400 : 500)).json({ message: err.message }));

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI).then(() => app.listen(PORT, () => console.log(`API on :${PORT}`)));
