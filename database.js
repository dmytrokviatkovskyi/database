import dotenv from 'dotenv'
import pg from 'pg'
dotenv.config()
console.log("DB_URL =", process.env.DB_URL);

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const initializeDatabase = async () => {
    console.log('Initializing book database...')

    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS book (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT DEFAULT 'Unknown',
        publication_year INTEGER,
        pages INTEGER,
        rating NUMERIC(3,2),
        is_available BOOLEAN DEFAULT TRUE,
        borrower_contact TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;

    try {
        await pool.query(createTableQuery);
        console.log('Books table is ready.');
    } catch(error) {
        console.error("Error initializing database:", error.message);
        throw error;
    }
};

// INSERT
async function addBook(title, author, genre, year, pages, rating, contact, notes) {

    if (rating < 0 || rating > 5) {
        console.error("Помилка: rating має бути від 0 до 5");
        return;
    }

    const query = `
        INSERT INTO book
        (title, author, genre, publication_year, pages, rating, borrower_contact, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`;

    const values = [title, author, genre, year, pages, rating, contact, notes];

    try {
        const res = await pool.query(query, values);
        console.log("Книгу додано:", res.rows[0]);
    } catch(err) {
        console.error("Error:", err.message);
    }
}

// SELECT
async function getAllBooks() {

    const res = await pool.query("SELECT * FROM book");

    console.table(res.rows);
}

// перевірка чи існує книга
async function bookExists(id) {

    const res = await pool.query(
        "SELECT * FROM book WHERE id = $1",
        [id]
    );

    return res.rows.length > 0;
}

// UPDATE
async function updateBookRating(id, newRating) {

    if (isNaN(id) || id <= 0) {
        console.error("Помилка: ID має бути додатним числом");
        return;
    }

    if (!(await bookExists(id))) {
        console.error(`Помилка: Книгу з ID ${id} не знайдено`);
        return;
    }

    if (newRating < 0 || newRating > 5) {
        console.error("Помилка: rating має бути від 0 до 5");
        return;
    }

    const query = `
        UPDATE book
        SET rating = $1
        WHERE id = $2
        RETURNING *`;

    const res = await pool.query(query, [newRating, id]);

    console.log("Книгу оновлено:", res.rows[0]);
}

// DELETE
async function deleteBook(id) {

    if (isNaN(id) || id <= 0) {
        console.error("Помилка: ID має бути додатним числом");
        return;
    }

    if (!(await bookExists(id))) {
        console.error(`Помилка: Книгу з ID ${id} не знайдено`);
        return;
    }

    await pool.query(
        "DELETE FROM book WHERE id = $1",
        [id]
    );

    console.log(`Книгу з ID ${id} було видалено.`);
}

(async () => {

    try {

        await initializeDatabase();

        switch(process.argv[2]) {

            case "list": {
                await getAllBooks();
                break;
            }

            case "add": {

                if (process.argv.length < 11) {
                    console.log("Usage:");
                    console.log("node db.js add <title> <author> <genre> <year> <pages> <rating> <contact> <notes>");
                    break;
                }

                await addBook(
                    process.argv[3],
                    process.argv[4],
                    process.argv[5],
                    parseInt(process.argv[6]),
                    parseInt(process.argv[7]),
                    parseFloat(process.argv[8]),
                    process.argv[9],
                    process.argv[10]
                );

                break;
            }

            case "update": {

                if (process.argv.length < 5) {
                    console.log("Usage: node db.js update <id> <rating>");
                    break;
                }

                const id = parseInt(process.argv[3]);
                const rating = parseFloat(process.argv[4]);

                if (isNaN(id) || isNaN(rating)) {
                    console.log("Помилка: ID та rating мають бути числами");
                    break;
                }

                await updateBookRating(id, rating);
                break;
            }

            case "delete": {

                if (process.argv.length < 4) {
                    console.log("Usage: node db.js delete <id>");
                    break;
                }

                const id = parseInt(process.argv[3]);

                if (isNaN(id)) {
                    console.log("Помилка: ID має бути числом");
                    break;
                }

                await deleteBook(id);
                break;
            }

            case "help": {
                console.log("Доступні команди:");
                console.log("node db.js list");
                console.log("node db.js add <title> <author> <genre> <year> <pages> <rating> <contact> <notes>");
                console.log("node db.js update <id> <rating>");
                console.log("node db.js delete <id>");
                break;
            }

            default: {
                console.log("Usage: node db.js [list|add|update|delete|help]");
                break;
            }
        }

    } catch(err) {

        console.error("Error:", err.message);

    } finally {

        console.log("Завершення роботи з базою даних...");
        process.exit();

    }

})();
