import dotenv from 'dotenv'
import pg from 'pg'
dotenv.config()

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const initializeDatabase = async () => {
    console.log('--- Ініціалізація бази даних Sidorovich Engine v1.0 ---')

    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS artifacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        origin_anomaly TEXT NOT NULL,
        rarity TEXT DEFAULT 'Common',
        radiation_level NUMERIC(4,2), -- В мілірентгенах
        weight NUMERIC(4,2),
        market_value INTEGER, -- Ціна в купонах
        is_contained BOOLEAN DEFAULT TRUE,
        stalker_owner TEXT,
        properties_notes TEXT,
        found_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;

    try {
        await pool.query(createTableQuery);
        console.log('Сховище артефактів готове до експлуатації.');
    } catch(error) {
        console.error("Критична помилка систем:", error.message);
        throw error;
    }
};

// INSERT (Додати артефакт)
async function addArtifact(name, anomaly, rarity, rad, weight, value, owner, notes) {
    // Валідація радіації (не може бути від'ємною)
    if (rad < 0) {
        console.error("Помилка: Радіаційний фон не може бути від'ємним!");
        return;
    }

    const query = `
        INSERT INTO artifacts
        (name, origin_anomaly, rarity, radiation_level, weight, market_value, stalker_owner, properties_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`;

    const values = [name, anomaly, rarity, rad, weight, value, owner, notes];

    try {
        const res = await pool.query(query, values);
        console.log("Артефакт занесено в реєстр:", res.rows[0].name);
    } catch(err) {
        console.error("Помилка при скануванні:", err.message);
    }
}

// SELECT (Список усіх артефактів)
async function getInventory() {
    console.log("--- ПОТОЧНИЙ ВМІСТ КОНТЕЙНЕРІВ ---");
    const res = await pool.query("SELECT * FROM artifacts ORDER BY id ASC");
    console.table(res.rows);
}

// Перевірка наявності в базі
async function artifactExists(id) {
    const res = await pool.query("SELECT * FROM artifacts WHERE id = $1", [id]);
    return res.rows.length > 0;
}

// UPDATE (Оновити ринкову вартість)
async function updateValue(id, newValue) {
    if (isNaN(id) || id <= 0) {
        console.error("Помилка: Невірний ID лота");
        return;
    }

    if (!(await artifactExists(id))) {
        console.error(`Помилка: Об'єкт №${id} відсутній у базі`);
        return;
    }

    const query = `
        UPDATE artifacts
        SET market_value = $1
        WHERE id = $2
        RETURNING *`;

    const res = await pool.query(query, [newValue, id]);
    console.log("Ціну оновлено. Сидорович задоволений:", res.rows[0].name);
}

// DELETE (Видалити/Продати артефакт)
async function decommissionArtifact(id) {
    if (!(await artifactExists(id))) {
        console.error(`Помилка: Об'єкт №${id} не знайдено.`);
        return;
    }

    await pool.query("DELETE FROM artifacts WHERE id = $1", [id]);
    console.log(`Об'єкт №${id} вилучено зі сховища (списано або продано).`);
}

(async () => {
    try {
        await initializeDatabase();

        const command = process.argv[2];

        switch(command) {
            case "inventory": {
                await getInventory();
                break;
            }

            case "scan": { // Раніше 'add'
                if (process.argv.length < 11) {
                    console.log("Використання:");
                    console.log("node db.js scan <назва> <аномалія> <рідкість> <радіація> <вага> <ціна> <власник> <нотатки>");
                    break;
                }
                await addArtifact(
                    process.argv[3], // назва
                    process.argv[4], // аномалія
                    process.argv[5], // рідкість
                    parseFloat(process.argv[6]), // радіація
                    parseFloat(process.argv[7]), // вага
                    parseInt(process.argv[8]),   // ціна
                    process.argv[9], // власник
                    process.argv[10] // нотатки
                );
                break;
            }

            case "revalue": { // Раніше 'update'
                const id = parseInt(process.argv[3]);
                const price = parseInt(process.argv[4]);
                await updateValue(id, price);
                break;
            }

            case "dispose": { // Раніше 'delete'
                const id = parseInt(process.argv[3]);
                await decommissionArtifact(id);
                break;
            }

            case "pda": {
                console.log("Доступні команди КПК:");
                console.log("node db.js inventory - перегляд сховища");
                console.log("node db.js scan <name> <anomaly> <rarity> <rad> <weight> <value> <owner> <notes> - додати артефакт");
                console.log("node db.js revalue <id> <new_price> - змінити ціну");
                console.log("node db.js dispose <id> - видалити об'єкт");
                break;
            }

            default: {
                console.log("Невідомий сигнал. Спробуйте: node db.js pda");
                break;
            }
        }

    } catch(err) {
        console.error("Аномальна помилка виконання:", err.message);
    } finally {
        console.log("--- Зв'язок розірвано ---");
        process.exit();
    }
})();
