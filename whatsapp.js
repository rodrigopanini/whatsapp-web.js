const express = require("express");
var cors = require("cors");
const axios = require("axios");
const https = require("https");

const api = axios.create({
    baseURL: "https://localhost:7020/api/webhooks/whatsapp-web",
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(cors());
const port = 3000;

const {
    Client,
    Location,
    LocalAuth,
    MessageMedia,
    Buttons,
    List,
} = require("whatsapp-web.js");

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false },
});

client.initialize();

client.on("loading_screen", (percent, message) => {
    console.log("CARREGANDO MENSAGENS", percent, message);
});

client.on("qr", (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log("QR RECEBIDO", qr);
});

client.on("authenticated", () => {
    console.log("AUTENTICADO");
});

client.on("auth_failure", (msg) => {
    // Fired if session restore was unsuccessful
    console.error("FALHA DE AUTENTICAÇÃO", msg);
});

client.on("ready", () => {
    console.log("PRONTO");
});

client.on("message", async (msg) => {
    console.log("Mensagem recebida", msg.body);
    console.log(msg);
    await api
        .post("mensagem", msg)
        .then(function (response) {
            //console.log(response);
        })
        .catch(function (error) {
            console.log(msg);

            console.log(error);
        });

    if (msg.body === "!ping reply") {
        // Send a new message as a reply to the current one
        msg.reply("pong");
    } else if (msg.body === "!ping") {
        // Send a new message to the same chat
        const vRet = await client.sendMessage(msg.from, "pong");
    } else if (msg.body.startsWith("!sendto ")) {
        // Direct send a new message to specific id
        let number = msg.body.split(" ")[1];
        let messageIndex = msg.body.indexOf(number) + number.length;
        let message = msg.body.slice(messageIndex, msg.body.length);
        number = number.includes("@c.us") ? number : `${number}@c.us`;
        let chat = await msg.getChat();
        chat.sendSeen();
        client.sendMessage(number, message);
    } else if (msg.body.startsWith("!subject ")) {
        // Change the group subject
        let chat = await msg.getChat();
        if (chat.isGroup) {
            let newSubject = msg.body.slice(9);
            chat.setSubject(newSubject);
        } else {
            msg.reply("This command can only be used in a group!");
        }
    } else if (msg.body.startsWith("!echo ")) {
        // Replies with the same message
        msg.reply(msg.body.slice(6));
    } else if (msg.body.startsWith("!desc ")) {
        // Change the group description
        let chat = await msg.getChat();
        if (chat.isGroup) {
            let newDescription = msg.body.slice(6);
            chat.setDescription(newDescription);
        } else {
            msg.reply("This command can only be used in a group!");
        }
    } else if (msg.body === "!leave") {
        // Leave the group
        let chat = await msg.getChat();
        if (chat.isGroup) {
            chat.leave();
        } else {
            msg.reply("This command can only be used in a group!");
        }
    } else if (msg.body.startsWith("!join ")) {
        const inviteCode = msg.body.split(" ")[1];
        try {
            await client.acceptInvite(inviteCode);
            msg.reply("Joined the group!");
        } catch (e) {
            msg.reply("That invite code seems to be invalid.");
        }
    } else if (msg.body === "!groupinfo") {
        let chat = await msg.getChat();
        if (chat.isGroup) {
            msg.reply(`
                *Group Details*
                Name: ${chat.name}
                Description: ${chat.description}
                Created At: ${chat.createdAt.toString()}
                Created By: ${chat.owner.user}
                Participant count: ${chat.participants.length}
            `);
        } else {
            msg.reply("This command can only be used in a group!");
        }
    } else if (msg.body === "!chats") {
        const chats = await client.getChats();
        client.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
    } else if (msg.body === "!info") {
        let info = client.info;
        client.sendMessage(
            msg.from,
            `
            *Connection info*
            User name: ${info.pushname}
            My number: ${info.wid.user}
            Platform: ${info.platform}
        `
        );
    } else if (msg.body === "!mediainfo" && msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
        msg.reply(`
            *Media info*
            MimeType: ${attachmentData.mimetype}
            Filename: ${attachmentData.filename}
            Data (length): ${attachmentData.data.length}
        `);
    } else if (msg.body === "!quoteinfo" && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();

        quotedMsg.reply(`
            ID: ${quotedMsg.id._serialized}
            Type: ${quotedMsg.type}
            Author: ${quotedMsg.author || quotedMsg.from}
            Timestamp: ${quotedMsg.timestamp}
            Has Media? ${quotedMsg.hasMedia}
        `);
    } else if (msg.body === "!resendmedia" && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const attachmentData = await quotedMsg.downloadMedia();
            client.sendMessage(msg.from, attachmentData, {
                caption: "Here's your requested media.",
            });
        }
    } else if (msg.body === "!send64") {
        const media = new MessageMedia(
            "application/pdf",
            "JVBERi0xLjQKJeLjz9MKMiAwIG9iago8PC9UeXBlL1hPYmplY3QvU3VidHlwZS9JbWFnZS9XaWR0aCAxMDAvSGVpZ2h0IDI1L0xlbmd0aCA3NTIvQ29sb3JTcGFjZVsvSW5kZXhlZC9EZXZpY2VSR0IgMjU1KAAAAPf39360mmZmZkROScXFxSQvXCl3nImnraoYIBs=",
            "Boleto.pdf"
        );
        client.sendMessage(msg.from, media, {
            caption: "Here's your requested media.",
        });
    } else if (msg.body === "!location") {
        msg.reply(
            new Location(37.422, -122.084, "Googleplex\nGoogle Headquarters")
        );
    } else if (msg.location) {
        msg.reply(msg.location);
    } else if (msg.body.startsWith("!status ")) {
        const newStatus = msg.body.split(" ")[1];
        await client.setStatus(newStatus);
        msg.reply(`Status foi atualizado para *${newStatus}*`);
    } else if (msg.body === "!mention") {
        const contact = await msg.getContact();
        const chat = await msg.getChat();
        chat.sendMessage(`Oi @${contact.number}!`, {
            mentions: [contact],
        });
    } else if (msg.body === "!delete") {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.fromMe) {
                quotedMsg.delete(true);
            } else {
                msg.reply("Eu posso remover somente minhas próprias mensagens");
            }
        }
    } else if (msg.body === "!pin") {
        const chat = await msg.getChat();
        await chat.pin();
    } else if (msg.body === "!archive") {
        const chat = await msg.getChat();
        await chat.archive();
    } else if (msg.body === "!mute") {
        const chat = await msg.getChat();
        // mute the chat for 20 seconds
        const unmuteDate = new Date();
        unmuteDate.setSeconds(unmuteDate.getSeconds() + 20);
        await chat.mute(unmuteDate);
    } else if (msg.body === "!typing") {
        const chat = await msg.getChat();
        // simulates typing in the chat
        chat.sendStateTyping();
    } else if (msg.body === "!recording") {
        const chat = await msg.getChat();
        // simulates recording audio in the chat
        chat.sendStateRecording();
    } else if (msg.body === "!clearstate") {
        const chat = await msg.getChat();
        // stops typing or recording in the chat
        chat.clearState();
    } else if (msg.body === "!jumpto") {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            client.interface.openChatWindowAt(quotedMsg.id._serialized);
        }
    } else if (msg.body === "!buttons") {
        let button = new Buttons(
            "Corpo da mensagem",
            [{ body: "bt1" }, { body: "bt2" }, { body: "bt3" }],
            "Título",
            "Rodapé"
        );
        client.sendMessage(msg.from, button);
    } else if (msg.body === "!list") {
        let sections = [
            {
                title: "Título",
                rows: [
                    { title: "Opção 1" },
                    { title: "Opção 2" },
                    { title: "Opção 3" },
                ],
            },
        ];
        let list = new List(
            "Corpo da lista",
            "VER OPÇÕES",
            sections,
            "Título",
            "Rodapé"
        );
        client.sendMessage(msg.from, list);
    } else if (msg.body === "!reaction") {
        msg.react("👍");
    }
});

client.on("message_create", (msg) => {
    // Disparado em todas as criações de mensagens, incluindo as suas
    if (msg.fromMe) {
        // faça coisas aqui
    }
});

client.on("message_revoke_everyone", async (after, before) => {
    // Disparado sempre que uma mensagem é apagada por alguém (incluindo você)
    console.log("Mensagem apagada", before.type);
    //console.log(after); // mensagem depois de ser apagada.
    if (before) {
        console.log(before.body); // mensagem antes de ser apagada.
    }
});

client.on("message_revoke_me", async (msg) => {
    // Disparado sempre que uma mensagem é excluída apenas em sua própria visualização.
    console.log(msg.body); // mensagem antes de ser apagada.
});

client.on("message_ack", async (msg, ack) => {
    /*
        == ACK VALUES ==
        ACK_ERROR: -1
        ACK_PENDING: 0
        ACK_SERVER: 1
        ACK_DEVICE: 2
        ACK_READ: 3
        ACK_PLAYED: 4
    */

    await api
        .post(`status/${ack}`, msg)
        .then(function (response) {
            //console.log(response);
        })
        .catch(function (error) {
            console.log(msg);

            console.log(error);
        });

    if (ack == 2) {
        console.log("Mensagem entregue", msg);
    } else if (ack == 3) {
        console.log("Mensagem foi lida", msg.id, msg.body);
    }
});

client.on("group_join", (notification) => {
    // O usuário ingressou ou foi adicionado ao grupo.
    console.log("join", notification);
    //notification.reply("Usuário entrou.");
});

client.on("group_leave", (notification) => {
    // O usuário saiu ou foi expulso do grupo.
    console.log("group_leave", notification);
    //notification.reply("Usuário saiu.");
});

client.on("group_update", (notification) => {
    // A foto, o assunto ou a descrição do grupo foram atualizados.
    console.log("group_update", notification);
});

client.on("change_state", (state) => {
    console.log("MUDANÇA DE ESTADO", state);
});

client.on("disconnected", (reason) => {
    console.log("Cliente saiu", reason);
});

app.get("/", (req, res) => res.send({ cod: 0, msg: "ok" }));

app.post("/send", async (req, res) => {
    let vRetorno = [];

    console.log(req.body);

    await client.sendPresenceAvailable(); //Online

    let vDadosArray = req.body;
    let vID = "";

    for (i = 0; i < vDadosArray.length; i++) {
        try {
            const chat = await client.getChatById(`${vDadosArray[i].to}@c.us`);
            if (chat) {
                await chat.sendSeen(); //Visualizada
                await chat.sendStateTyping(); //Escrevendo...
            }

            if (vDadosArray[i].type === "text") {
                const vMsg = await client.sendMessage(
                    `${vDadosArray[i].to}@c.us`,
                    vDadosArray[i].body
                );
                vID = vMsg.id.id;
            } else if (vDadosArray[i].type === "doc") {
                const media = await new MessageMedia(
                    vDadosArray[i].doc.type,
                    vDadosArray[i].doc.base64,
                    vDadosArray[i].doc.name
                );
                if (vDadosArray[i].doc.body) {
                    await client.sendMessage(
                        `${vDadosArray[i].to}@c.us`,
                        vDadosArray[i].doc.body
                    );
                }
                const vMsg = await client.sendMessage(
                    `${vDadosArray[i].to}@c.us`,
                    media
                );
                vID = vMsg.id.id;
            } else if (vDadosArray[i].type === "btn") {
                let button = new Buttons(
                    vDadosArray[i].btn.body,
                    vDadosArray[i].btn.buttons,
                    vDadosArray[i].btn.title,
                    vDadosArray[i].btn.footer
                );
                const vMsg = await client.sendMessage(
                    `${vDadosArray[i].to}@c.us`,
                    button
                );

                vID = vMsg.id.id;
            }
            if (chat) {
                chat.clearState(); //Limpar status
            }

            vRetorno.push({
                cod: 0,
                msg: "ok",
                id: vDadosArray[i].id?.id,
                whatsapp_id: vID,
            });
        } catch (error) {
            console.log(error);
            try {
                vRetorno.push({
                    cod: 1,
                    msg: error.stack,
                    id: vDadosArray[i].id?.id,
                });
            } catch (error1) {}
        }
    }

    res.send(vRetorno);
});

app.listen(port, () => console.log(`API WhatsApp iniciada na porta ${port}`));
