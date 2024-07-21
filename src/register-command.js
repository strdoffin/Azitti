require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'addtext',
        description: 'add text to db',
        options:[
            {
                name: 'key',
                description:'คำที่จะสอน',
                type: ApplicationCommandOptionType.String,
                required:true
            },
            {
                name: 'value',
                description:'ผลลัพธ์',
                type: ApplicationCommandOptionType.String,
                required:true
            }
        ]
    },
    {
        name: 'ping',
        description: 'reply pong',
    },
    {
        name:'berm',
        description:'show all data in database'
    }

];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Registering slash command');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Completed');
    } catch (e) {
        console.log(`There was an error: \n ${e}`);
    }
})();
