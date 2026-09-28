const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const deriveKey = promisify(scrypt);
const books = require('./booksdb.js');
const regd_users = express.Router();
const users = [];
const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const isValid = username => users.some(user => user.username === username);

async function registerUser(username, password) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await deriveKey(password, salt, 64)).toString('hex');
  // Recheck after asynchronous hashing so concurrent registrations cannot duplicate a user.
  if (isValid(username)) return false;
  users.push({ username, salt, hash });
  return true;
}

async function authenticatedUser(username, password) {
  const user = users.find(item => item.username === username);
  if (!user || typeof password !== 'string') return false;
  const hash = await deriveKey(password, user.salt, 64);
  return timingSafeEqual(hash, Buffer.from(user.hash, 'hex'));
}

regd_users.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    if (!(await authenticatedUser(username.trim(), password))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.authorization = { accessToken: jwt.sign({ username: username.trim() }, jwtSecret, { expiresIn: '1h' }) };
      req.session.save(error => error ? next(error) : res.status(200).json({ message: 'Customer successfully logged in.' }));
    });
  } catch (error) { next(error); }
});

function requireAuth(req, res, next) {
  const token = req.session?.authorization?.accessToken;
  if (!token) return res.status(401).json({ message: 'Please log in to manage reviews.' });
  try {
    req.user = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired login. Please log in again.' });
  }
}
regd_users.use('/auth', requireAuth);

regd_users.put('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  const review = req.query.review ?? req.body.review;
  if (typeof review !== 'string' || !review.trim()) return res.status(400).json({ message: 'A non-empty review is required.' });
  const book = books[req.params.isbn];
  const existed = Object.hasOwn(book.reviews, req.user.username);
  // Define an own property safely even for unusual usernames such as __proto__.
  Object.defineProperty(book.reviews, req.user.username, { value: review.trim(), writable: true, enumerable: true, configurable: true });
  return res.status(200).json({ message: existed ? 'Review successfully modified.' : 'Review successfully added.', reviews: book.reviews });
});

regd_users.delete('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  const reviews = books[req.params.isbn].reviews;
  if (!Object.hasOwn(reviews, req.user.username)) return res.status(404).json({ message: 'You have no review for this book.' });
  delete reviews[req.user.username];
  return res.status(200).json({ message: 'Review successfully deleted.', reviews });
});

module.exports = { authenticated: regd_users, isValid, users, registerUser, authenticatedUser };
