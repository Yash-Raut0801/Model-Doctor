require('dotenv').config();              // loads .env into process.env (alt: Node 20+ `node --env-file=.env`)
const express = require('express');     // HTTP framework (alt: Fastify, Koa)
const cors = require('cors');            // browsers block cross-origin calls unless the API allows them
const mongoose = require('mongoose');    // schema + validation layer over MongoDB (alt: native driver, Prisma)
const routes = require('./routes');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN })); // allow only our frontend, not the whole internet
app.use(express.json());                 // parses JSON bodies into req.body
app.use('/api', routes);                 // every route lives under /api, which keeps URLs tidy and proxy-friendly

// Error middleware: 4 arguments tells Express this is the error handler. One place for all failures.
app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
 
const PORT = process.env.PORT || 5000;
// Connect to the DB BEFORE listening so we never accept requests we can't serve.
mongoose.connect(process.env.MONGO_URI).then(() => app.listen(PORT, () => console.log(`API on :${PORT}`)));
