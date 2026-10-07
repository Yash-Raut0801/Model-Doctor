import { Router } from 'express';
import bcrypt from 'bcryptjs'; // pure-JS bcrypt (alt: `bcrypt` native = faster, needs compiling; argon2 = newer standard)
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from './models.js';
import { protect } from './middleware.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });

// JWT = signed token: header.payload.signature. The server signs {id} with a secret; only it can make valid ones.
// The payload is readable by anyone (it's only base64), so NEVER put secrets in it.
const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email }); // whitelist what leaves the server

router.post('/register', async (req, res, next) => {
  try {
    const p = registerSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
    const { name, email, password } = p.data;
    if (await User.findOne({ email })) return res.status(409).json({ message: 'That email is already registered' });
    // Hashing = one-way. Cost 10 = 2^10 rounds: slow on purpose, so brute-forcing a stolen DB is expensive. bcrypt adds a random salt itself.
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'That email is already registered' }); // two simultaneous sign-ups
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
    const user = await User.findOne({ email: p.data.email });
    // Same message for "no such email" and "wrong password": don't help attackers discover which emails exist.
    if (!user || !(await bcrypt.compare(p.data.password, user.password))) return res.status(401).json({ message: 'Wrong email or password' });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

// Lets the frontend ask "is my saved token still valid, and who am I?" on page load.
router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
