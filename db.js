const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'gang_payments.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Create members table
        db.run(`CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            discord_id TEXT
        )`);

        // Create payments table
        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            week_date TEXT,
            amount INTEGER DEFAULT 300000,
            is_paid INTEGER DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members (id),
            UNIQUE(member_id, week_date)
        )`);

        // Insert initial members if table is empty
        db.get("SELECT COUNT(*) AS count FROM members", (err, row) => {
            if (row.count === 0) {
                const members = [
                    "Lee Burapha",
                    "Mykle Watchet",
                    "WHITE Lily",
                    "Toei Jeandang",
                    "Nongnom Cc",
                    "BLACK BOWEN",
                    "JULONG HUANG",
                    "Kan Redwood",
                    "Samlee Burapha",
                    "Lhum Burapha",
                    "Juedjang Rairabiap",
                    "Lego Pampam",
                    "Smile ZimonS Goodman very happy",
                    "DAWUT BUSCAS",
                    "Suea Qila",
                    "Arfei Rin"
                ];
                const stmt = db.prepare("INSERT INTO members (name) VALUES (?)");
                members.forEach(name => {
                    stmt.run(name);
                });
                stmt.finalize();
                console.log("Initial members inserted.");
            }
        });
    });
}

module.exports = db;
