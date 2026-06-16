const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Discord Webhook URL from prompt
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1516406090428842044/5cJXYA1Q-jIuIeQ2BpreCmIWRmWPGPr5PRcfTGjym6PSJ8E2lBzX7uYQBjARQolX2qmB';

// APIs

// 1. Get all data (members and payments)
app.get('/api/data', (req, res) => {
    db.all("SELECT * FROM members", [], (err, members) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all("SELECT * FROM payments", [], (err, payments) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ members, payments });
        });
    });
});

// 2. Toggle Payment
app.post('/api/pay', (req, res) => {
    const { member_id, week_date, is_paid } = req.body;
    const amount = 300000;

    db.get("SELECT * FROM payments WHERE member_id = ? AND week_date = ?", [member_id, week_date], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            db.run("UPDATE payments SET is_paid = ? WHERE id = ?", [is_paid, row.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, action: 'updated' });
            });
        } else {
            db.run("INSERT INTO payments (member_id, week_date, amount, is_paid) VALUES (?, ?, ?, ?)", [member_id, week_date, amount, is_paid], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, action: 'inserted' });
            });
        }
    });
});

// 2.5 Add Member
app.post('/api/members', (req, res) => {
    const { name, discord_id } = req.body;
    if (!name) return res.status(400).json({ error: "Missing name" });

    db.run("INSERT INTO members (name, discord_id) VALUES (?, ?)", [name, discord_id || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// 2.6 Delete Member
app.delete('/api/members/:id', (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing ID" });

    // Delete member's payments first (foreign key constraint might not be enabled by default in sqlite3, but good practice)
    db.run("DELETE FROM payments WHERE member_id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Delete member
        db.run("DELETE FROM members WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// 2.7 Edit Member
app.put('/api/members/:id', (req, res) => {
    const { id } = req.params;
    const { name, discord_id } = req.body;
    
    if (!id || !name) return res.status(400).json({ error: "Missing ID or Name" });

    db.run("UPDATE members SET name = ?, discord_id = ? WHERE id = ?", [name, discord_id || null, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 3. Notify Unpaid via Discord
app.post('/api/notify', async (req, res) => {
    const { week_date } = req.body;
    if (!week_date) return res.status(400).json({ error: "Missing week_date" });

    db.all(`
        SELECT m.name, m.discord_id, IFNULL(p.is_paid, 0) as paid 
        FROM members m 
        LEFT JOIN payments p ON m.id = p.member_id AND p.week_date = ?
    `, [week_date], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const unpaid = rows.filter(r => r.paid === 0);
        
        if (unpaid.length === 0) {
            return res.json({ success: true, message: "Everyone has paid!" });
        }

        let content = `🚨 **ประกาศทวงเงินแก๊งประจำสัปดาห์ [${week_date}]** 🚨\n`;
        content += `จ่ายกันด้วยโว้ยยยยยอดละ 300,000!\n\n**คนที่ยังไม่จ่าย:**\n`;
        unpaid.forEach(m => {
            if (m.discord_id) {
                content += `- <@${m.discord_id}> (${m.name})\n`;
            } else {
                content += `- ${m.name}\n`;
            }
        });

        try {
            await axios.post(DISCORD_WEBHOOK_URL, { content });
            res.json({ success: true });
        } catch (error) {
            console.error("Discord webhook error:", error.message);
            res.status(500).json({ error: "Failed to send to Discord" });
        }
    });
});

// 4. Summary to Discord
app.post('/api/summary', async (req, res) => {
    const { week_date } = req.body;
    if (!week_date) return res.status(400).json({ error: "Missing week_date" });

    db.all(`
        SELECT m.name, IFNULL(p.is_paid, 0) as paid, IFNULL(p.amount, 300000) as amount
        FROM members m 
        LEFT JOIN payments p ON m.id = p.member_id AND p.week_date = ?
    `, [week_date], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const paid = rows.filter(r => r.paid === 1);
        const unpaid = rows.filter(r => r.paid === 0);
        const totalMissing = unpaid.length * 300000;

        let embed = {
            title: `📊 สรุปยอดเงินแก๊งประจำสัปดาห์ [${week_date}]`,
            color: 16766720, // Yellowish
            fields: [
                {
                    name: `✅ จ่ายแล้ว (${paid.length} คน)`,
                    value: paid.length > 0 ? paid.map(m => `- ${m.name}`).join('\n') : "ไม่มี",
                    inline: true
                },
                {
                    name: `❌ ยังไม่จ่าย (${unpaid.length} คน)`,
                    value: unpaid.length > 0 ? unpaid.map(m => `- ${m.name}`).join('\n') : "ไม่มี",
                    inline: true
                },
                {
                    name: "💰 ยอดค้างชำระรวม",
                    value: `**${totalMissing.toLocaleString()}** บาท`,
                    inline: false
                }
            ],
            timestamp: new Date().toISOString()
        };

        try {
            await axios.post(DISCORD_WEBHOOK_URL, { embeds: [embed] });
            res.json({ success: true });
        } catch (error) {
            console.error("Discord webhook error:", error.message);
            res.status(500).json({ error: "Failed to send to Discord" });
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
