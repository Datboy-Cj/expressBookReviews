const express = require('express');
const axios = require('axios');
const books = require('./booksdb.js');
const { isValid, registerUser } = require('./auth_users.js');
const public_users = express.Router();

public_users.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    if (isValid(username.trim()) || !(await registerUser(username.trim(), password))) {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    return res.status(201).json({ message: 'User successfully registered. You can now log in.' });
  } catch (error) { next(error); }
});

// Public REST endpoints use the original, supplied booksdb.js data.
public_users.get('/', (req, res) => res.status(200).json(books));
public_users.get('/isbn/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  return res.status(200).json(books[req.params.isbn]);
});
function searchBooks(field, value) {
  return Object.fromEntries(Object.entries(books).filter(([, book]) => book[field].toLowerCase() === value.trim().toLowerCase()));
}
public_users.get('/author/:author', (req, res) => {
  const matches = searchBooks('author', req.params.author);
  return Object.keys(matches).length ? res.status(200).json(matches) : res.status(404).json({ message: 'No books found for this author.' });
});
public_users.get('/title/:title', (req, res) => {
  const matches = searchBooks('title', req.params.title);
  return Object.keys(matches).length ? res.status(200).json(matches) : res.status(404).json({ message: 'No books found for this title.' });
});
public_users.get('/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  return res.status(200).json(books[req.params.isbn].reviews);
});

// Assignment tasks 10–13 / submission question 11:
// Four asynchronous Axios clients. They call the REST API without blocking other requests.
function createBookClient(baseURL = process.env.BOOK_API_URL || 'http://127.0.0.1:5000') {
  const api = axios.create({ baseURL, timeout: 5000 });

  // Get all books using async/await; optionally deliver the result to an error-first callback.
  async function getAllBooks(callback) {
    let data;
    try {
      const response = await api.get('/');
      data = response.data;
    } catch (error) {
      if (callback) return callback(error);
      throw error;
    }
    if (callback) callback(null, data);
    return data;
  }

  // Search by ISBN using explicit Promise callbacks.
  function getBooksByISBN(isbn) {
    return api.get(`/isbn/${encodeURIComponent(isbn)}`).then(response => response.data).catch(error => { throw error; });
  }

  // Search by author using async/await with Axios.
  async function getBooksByAuthor(author) {
    const response = await api.get(`/author/${encodeURIComponent(author)}`);
    return response.data;
  }

  // Search by title using async/await with Axios.
  async function getBooksByTitle(title) {
    const response = await api.get(`/title/${encodeURIComponent(title)}`);
    return response.data;
  }
  return { getAllBooks, getBooksByISBN, getBooksByAuthor, getBooksByTitle };
}
module.exports = { general: public_users, createBookClient, ...createBookClient() };

// Run "npm run client" with the server running to demonstrate all four calls concurrently.
if (require.main === module) {
  const client = createBookClient();
  Promise.all([
    client.getAllBooks((error, data) => { if (error) console.error(error.message); else console.log('All books (async callback):', data); }),
    client.getBooksByISBN('1').then(data => console.log('ISBN 1 (Promise):', data)),
    client.getBooksByAuthor('Unknown').then(data => console.log('Author Unknown:', data)),
    client.getBooksByTitle('Things Fall Apart').then(data => console.log('Title Things Fall Apart:', data))
  ]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
