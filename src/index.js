const postgres = require("postgres");
require("dotenv").config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, TOKEN } =
    process.env;

const sql = postgres({
    host: PGHOST,
    database: PGDATABASE,
    username: PGUSER,
    password: PGPASSWORD,
    port: 5432,
    ssl: "require",
    options: `project=${ENDPOINT_ID}`,
});

async function getLearnText() {
    try {
        const result = await sql`SELECT * FROM learntext`;
        // console.log(result);
        return result;
    } catch (err) {
        console.error("Error fetching data from learntext:", err);
        return [];
    }
}

async function addToDB(key, value){
    try {
        const query = await sql`INSERT INTO learntext(key, value) VALUES(${key}, ${value})`;
        console.log(query);
    } catch (err) {
        console.error("Error inserting data into learntext:", err);
    }
}

async function searchValuesInText(text) {
    try {
        const learnTextData = await getLearnText();
        let response = "";

        learnTextData.forEach(entry => {
            if (text.includes(entry.key)) {
                response = entry.value;
            }
        });

        if (response) {
            return response;
        } 
    } catch (err) {
    }
}

const { Client, IntentsBitField } = require("discord.js");

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

client.on("ready", (c) => {
    console.log(`🟢 ${c.user.username} is ready`);
});

client.on("messageCreate", async (msg) => {
    if (msg.content && !msg.author.bot) {
        const response = await searchValuesInText(msg.content);
        if(response){
            await msg.reply(response);
        }
    }
});

client.on("interactionCreate", async (inter) => {
    if (!inter.isCommand()) return;

    if (inter.commandName === "ping") {
        await inter.reply("pong!");
    } else if (inter.commandName === "addtext") {
        const key = inter.options.getString("key");
        const value = inter.options.getString("value");
        await addToDB(key, value);
        await inter.reply(`Add-Text \nคำที่จะสอน: ${key}\nผลลัพธ์: ${value}`);
    } else if (inter.commandName === "berm") {
        const learnText = await getLearnText();
        if (learnText.length > 0) {
            let response = "LearnText Data:\n\n";
            learnText.forEach((entry) => {
                response += `Id:${entry.id}\nKey: ${entry.key}\nValue: ${entry.value}\n\n`;
            });
            await inter.reply(response);
        } else {
            await inter.reply("No data found.");
        }
    }
});

client.login(TOKEN);



module.exports = (req, res) => {
    res.status(200).send("Discord Bot is running!");
};