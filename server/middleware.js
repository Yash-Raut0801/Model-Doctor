import jwt from 'jsonwebtoken';
import { User } from './models.js';

// Middleware = a function that runs BEFORE the route handler and can stop the request (401) or let it continue (next()).
export async function protect(req, res, next) {
  try {
    // Clients send: Authorization: Bearer <token>
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ message: 'Please sign in' });
    const { id } = jwt.verify(token, process.env.JWT_SECRET); // throws if forged, tampered or expired
    // Re-load the user each request so deleted accounts lose access immediately (alt: trust the token alone: faster, less safe).
    const user = await User.findById(id).select('-password'); // never carry the hash around
    if (!user) return res.status(401).json({ message: 'Account not found' });
    req.user = user; // handlers after this can read req.user
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
}
