# Book Review API — Final Project

Forked from [IBM's expressBookReviews starter](https://github.com/ibm-developer-skills-network/expressBookReviews). The assignment rubric abbreviates the repository name to `expressBookReview`; the real upstream name is plural.

## Run

Requires Node.js 18+ (Node.js 22+ recommended).

```sh
cd final_project
npm install
npm start
```

Default address: `http://127.0.0.1:5000`. Set `PORT=5050 npm start` to reproduce the submitted evidence. The original ten-book `router/booksdb.js` is unchanged. Its numeric keys are the assignment's ISBN identifiers.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | All books |
| GET | `/isbn/:isbn` | One book by ISBN |
| GET | `/author/:author` | All books matching an author |
| GET | `/title/:title` | All books matching a title |
| GET | `/review/:isbn` | Reviews (initially `{}`) |
| POST | `/register` | Register with JSON username and password |
| POST | `/customer/login` | Login; save the session cookie |
| PUT | `/customer/auth/review/:isbn` | Add/modify the current user's review, via JSON `review` or query parameter |
| DELETE | `/customer/auth/review/:isbn` | Delete only the current user's review |

Author/title searches are case-insensitive exact matches. Encode spaces in URL parameters. Use curl `-c cookies.txt` at login and `-b cookies.txt` for protected requests.

## Axios tasks in general.js

`router/general.js` includes the public Express routes and all four callable asynchronous Axios clients:

- `getAllBooks(callback)` — async/await and an optional error-first callback.
- `getBooksByISBN(isbn)` — Promise `.then()` / `.catch()` callbacks.
- `getBooksByAuthor(author)` — async/await.
- `getBooksByTitle(title)` — async/await.

With the server running, `npm run client` executes all four concurrently. Set `BOOK_API_URL=http://127.0.0.1:5050` if using the evidence port. `createBookClient(baseURL)` lets tests choose an isolated server address.

## Validation and evidence

Run `npm test`. Five integration test groups cover book retrieval, input errors, hashed passwords, login, review ownership, concurrent duplicate registration, and all four Axios clients including failure paths.

The repository's `evidence/` directory contains the actual cURL commands and outputs under the exact rubric filenames. The `bookreader` credentials in those files are disposable local demonstration data, not a real account. Session cookies are excluded.

Users, sessions, and reviews are in memory for this course project and reset on restart. Environment variables `SESSION_SECRET` and `JWT_SECRET` may configure signing keys; random keys are generated otherwise. This is a local educational application, not a production deployment.
