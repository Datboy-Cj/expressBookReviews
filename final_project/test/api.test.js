const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../index');
const books = require('../router/booksdb');
const { users } = require('../router/auth_users');
const { createBookClient } = require('../router/general');
let server, base;
before(async () => {
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
async function request(path, method = 'GET', body, cookie) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
test('public book endpoints preserve supplied data and return all author matches', async () => {
  assert.deepEqual((await request('/')).data, books);
  assert.equal((await request('/isbn/1')).data.title, 'Things Fall Apart');
  assert.deepEqual(Object.keys((await request('/author/Unknown')).data), ['4', '5', '6', '7']);
  assert.equal((await request('/title/Things%20Fall%20Apart')).data['1'].author, 'Chinua Achebe');
  assert.deepEqual((await request('/review/1')).data, {});
  for (const path of ['/isbn/999', '/isbn/__proto__', '/author/Nobody', '/title/Missing', '/review/999']) assert.equal((await request(path)).status, 404);
});
test('registration validates inputs, hashes passwords, rejects duplicates and invalid login', async () => {
  assert.equal((await request('/register', 'POST', {})).status, 400);
  assert.equal((await request('/register', 'POST', { username: 'alice', password: 'sample-password' })).status, 201);
  assert.equal(users.find(user => user.username === 'alice').password, undefined);
  assert.equal((await request('/register', 'POST', { username: 'alice', password: 'x' })).status, 409);
  assert.equal((await request('/customer/login', 'POST', { username: 'alice', password: 'wrong' })).status, 401);
});
test('reviews require login and each account can modify/delete only its own review', async () => {
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'No login' })).status, 401);
  const alice = (await request('/customer/login', 'POST', { username: 'alice', password: 'sample-password' })).cookie;
  await request('/register', 'POST', { username: 'bob', password: 'sample-password' });
  const bob = (await request('/customer/login', 'POST', { username: 'bob', password: 'sample-password' })).cookie;
  assert.ok(alice && bob);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'First review' }, alice)).data.reviews.alice, 'First review');
  await request('/customer/auth/review/1?review=Updated%20review', 'PUT', undefined, alice);
  await request('/customer/auth/review/1', 'PUT', { review: 'Bob review', username: 'alice' }, bob);
  assert.deepEqual((await request('/review/1')).data, { alice: 'Updated review', bob: 'Bob review' });
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: '' }, alice)).status, 400);
  assert.equal((await request('/customer/auth/review/999', 'PUT', { review: 'x' }, alice)).status, 404);
  assert.deepEqual((await request('/customer/auth/review/1', 'DELETE', undefined, alice)).data.reviews, { bob: 'Bob review' });
  assert.equal((await request('/customer/auth/review/1', 'DELETE', undefined, alice)).status, 404);
  await request('/customer/auth/review/1', 'DELETE', undefined, bob);
});
test('concurrent duplicate registrations produce exactly one account', async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => request('/register', 'POST', { username: 'concurrent', password: 'sample-password' })));
  assert.equal(results.filter(result => result.status === 201).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 4);
});
test('all four Axios clients work concurrently, including callback and rejected Promise paths', async () => {
  const client = createBookClient(base);
  const [all, isbn, author, title] = await Promise.all([client.getAllBooks(), client.getBooksByISBN('1'), client.getBooksByAuthor('Unknown'), client.getBooksByTitle('Things Fall Apart')]);
  assert.deepEqual(all, books);
  assert.equal(isbn.title, 'Things Fall Apart');
  assert.equal(Object.keys(author).length, 4);
  assert.equal(title['1'].author, 'Chinua Achebe');
  await new Promise((resolve, reject) => client.getAllBooks((error, data) => { if (error) return reject(error); assert.equal(Object.keys(data).length, 10); resolve(); }));
  await assert.rejects(client.getBooksByISBN('999'), error => error.response.status === 404);
  const unavailable = createBookClient('http://127.0.0.1:1');
  await new Promise(resolve => unavailable.getAllBooks(error => { assert.ok(error); resolve(); }));
});
