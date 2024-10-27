const { Client, GatewayIntentBits, IntentsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const postgres = require("postgres");
require("dotenv").config();

// Database connection setup
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

// Function to get all learn texts
async function getLearnText() {
    try {
        const result = await sql`SELECT * FROM learntext`;
        return result;
    } catch (err) {
        console.error("Error fetching data from learntext:", err);
        return [];
    }
}

// Function to add a new text entry to the database
async function addToDB(key, value) {
    try {
        const query = await sql`INSERT INTO learntext(key, value) VALUES(${key}, ${value})`;
        console.log(query);
    } catch (err) {
        console.error("Error inserting data into learntext:", err);
    }
}

// Function to search for values in text
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

// Discord client setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        IntentsBitField.Flags.GuildMembers
    ],
});

// Notify a specific channel about voice channel events
const channelIdToNotify = '977194094067613786'; // Replace with your text channel ID
const userVoiceChannel = new Map();

client.on("ready", () => {
    console.log(`${client.user.username} is ready!`);
    client.user.setActivity(`test 123`, { type: "WATCHING" });
});

// Handle incoming messages
client.on("messageCreate", async (msg) => {
    if (!msg.author.bot && msg.author.id !== client.user.id) {
        const response = await searchValuesInText(msg.content);
        if (response && response !== msg.content) {
            await msg.reply(response);
        }
    }
});

// Handle voice state updates
client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member;

    if (oldState.channelId !== newState.channelId) {
        const textChannel = member.guild.channels.cache.get(channelIdToNotify);

        if (!oldState.channelId && newState.channelId) {
            const channelName = newState.channel.name;
            if (textChannel) {
                textChannel.send(`**${member.user.tag}** has entered the voice channel: **${channelName}**`);
            }
        } else if (oldState.channelId && !newState.channelId) {
            const oldChannelName = oldState.channel.name;
            if (textChannel) {
                textChannel.send(`**${member.user.tag}** has disconnected from the voice channel: **${oldChannelName}**`);
            }
        } else if (oldState.channelId && newState.channelId) {
            const oldChannelName = oldState.channel.name;
            const newChannelName = newState.channel.name;
            if (textChannel) {
                textChannel.send(`**${member.user.tag}** has moved from **${oldChannelName}** to **${newChannelName}**`);
            }
        }
    }
    userVoiceChannel.set(member.id, newState.channelId);
});

// Function to send messages in chunks
async function sendMessageInChunks(inter, message) {
    const maxMessageLength = 2000;
    for (let i = 0; i < message.length; i += maxMessageLength) {
        const chunk = message.slice(i, i + maxMessageLength);
        await inter.followUp(chunk);
    }
}

// Handle command interactions
client.on("interactionCreate", async (inter) => {
    if (!inter.isCommand()) return;

    if (inter.commandName === "ping") {
        await inter.reply("pong!");
    }

    if (inter.commandName === "addtext") {
        const key = inter.options.getString("key");
        const value = inter.options.getString("value");
        await addToDB(key, value);
        await inter.reply(`Add-Text \nKey: ${key}\nValue: ${value}`);
    }

    if (inter.commandName === "berm") {
        const learnText = await getLearnText();
        const itemsPerPage = 10;
        const totalPages = Math.ceil(learnText.length / itemsPerPage);

        if (learnText.length > 0) {
            let currentPage = 0;

            const createEmbed = (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageData = learnText.slice(start, end);

                let response = `LearnText Data (Page ${page + 1}/${totalPages}):\n\n`;
                pageData.forEach((entry) => {
                    response += `\`Id: ${entry.id}\nKey: ${entry.key}\nValue: ${entry.value}\`\n\n`;
                });

                return response;
            };

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage >= totalPages - 1)
                );

            const embedMessage = await inter.reply({
                content: createEmbed(currentPage),
                components: [row],
                fetchReply: true, // Fetch the reply to get the message object
            });

            const filter = (buttonInter) => buttonInter.user.id === inter.user.id; // Only allow the original user to interact
            const collector = embedMessage.createMessageComponentCollector({ filter, time: 60000 }); // 60 seconds to interact

            collector.on('collect', async (buttonInter) => {
                if (buttonInter.customId === 'prev' && currentPage > 0) {
                    currentPage--;
                } else if (buttonInter.customId === 'next' && currentPage < totalPages - 1) {
                    currentPage++;
                }

                // Update the message with the new page content
                await buttonInter.update({
                    content: createEmbed(currentPage),
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('prev')
                                    .setLabel('Previous')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(currentPage === 0),
                                new ButtonBuilder()
                                    .setCustomId('next')
                                    .setLabel('Next')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(currentPage >= totalPages - 1)
                            )
                    ],
                });
            });

            collector.on('end', () => {
                // Disable buttons after the time expires
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );

                embedMessage.edit({ components: [disabledRow] });
            });
        } else {
            await inter.reply("No data found.");
        }
    }
});

// Login to the Discord bot
client.login(TOKEN);
