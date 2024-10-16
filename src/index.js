const { Client, GatewayIntentBits, IntentsBitField } = require("discord.js");
const postgres = require("postgres");
require("dotenv").config();


let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, TOKEN } = process.env;


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
        return result;
    } catch (err) {
        console.error("Error fetching data from learntext:", err);
        return [];
    }
}

async function addToDB(key, value) {
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

        return response || null;
    } catch (err) {
        console.error("Error searching values in text:", err);
        return null;
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        IntentsBitField.Flags.GuildMembers
    ],
});

const channelIdToNotify = '977194094067613786'; // Replace with your text channel ID
const userVoiceChannel = new Map();

client.on("ready", () => {
    console.log(`${client.user.username} is ready!`);
    client.user.setActivity(`test 123`, { type: "WATCHING" });
});

client.on("messageCreate", async (msg) => {
    if (msg.content && !msg.author.bot) {
        const response = await searchValuesInText(msg.content);
        if (response) {
            await msg.reply(response);
        }
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member;

    if (oldState.channelId !== newState.channelId) {
        const textChannel = member.guild.channels.cache.get(channelIdToNotify);

        if (!oldState.channelId && newState.channelId) {
            // User has joined a voice channel
            const channelName = newState.channel.name;
            if (textChannel) {
                textChannel.send(`**${member.user.tag}** has entered the voice channel: **${channelName}**`);
            }
        } else if (oldState.channelId && !newState.channelId) {
            // User has disconnected from a voice channel
            const oldChannelName = oldState.channel.name;
            if (textChannel) {
                textChannel.send(`**${member.user.tag}** has disconnected from the voice channel: **${oldChannelName}**`);
            }
        } else if (oldState.channelId && newState.channelId) {
            // User has moved from one voice channel to another
            const oldChannelName = oldState.channel.name;
            const newChannelName = newState.channel.name;
            if (textChannel) {
                textChannel.send(`**${member.user.tag}** has moved from **${oldChannelName}** to **${newChannelName}**`);
            }
        }
    }
    userVoiceChannel.set(member.id, newState.channelId);
});

client.on("interactionCreate", async (inter) => {
    if (!inter.isCommand()) return;

    if (inter.commandName === "ping") {
        await inter.reply("pong!");
    } else if (inter.commandName === "addtext") {
        const key = inter.options.getString("key");
        const value = inter.options.getString("value");
        await addToDB(key, value);
        await inter.reply(`Add-Text \nKey: ${key}\nValue: ${value}`);
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
