'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const config = require('./config');

// base URL for webhook server
const baseURL = "your-webhook-url";

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// serve static and downloaded files
app.use('/static', express.static('static'));
app.use('/downloaded', express.static('downloaded'));

app.get('', (req, res) => {
  res.send('hello world')
});
// webhook callback
app.post('/callback', line.middleware(config), (req, res) => {
  // req.body.events should be an array of events
  if (!Array.isArray(req.body.events)) {
    return res.status(500).end();
  }

  // handle events separately
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// simple reply function
const replyText = (token, texts) => {
  texts = Array.isArray(texts) ? texts : [texts];
  return client.replyMessage(
    token,
    texts.map((text) => ({ type: 'text', text }))
  );
};

// callback function to handle a single event
function handleEvent(event) {
  switch (event.type) {
    case 'message':
      const message = event.message;
      switch (message.type) {
        case 'text':     
          if(message.text.includes("nama") || message.text.includes("email") || message.text.includes("Nama") || message.text.includes("Email")){
            const splitter = message.text.split(" ")
            return handleRegistration(splitter, event.replyToken, event.source);
          }
          return handleText(message, event.replyToken, event.source);
        case 'image':
          return handleImage(message, event.replyToken);
        case 'video':
          return handleVideo(message, event.replyToken);
        case 'audio':
          return handleAudio(message, event.replyToken);
        case 'location':
          return handleLocation(message, event.replyToken);
        case 'sticker':
          return handleSticker(message, event.replyToken);
        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }
}

function handleRegistration(message, replyToken, source){
  
  const command = message[0]
  const action = command.toLowerCase();
  console.log(message[0] + ' -> ' + message[1])
  switch(action){
    case 'nama':
      return replyText(
        replyToken,
        `Hai, ${message[1]}. Sekarang masukkan email kamu yaa, cth: email john.doe@dexagroup.com`
      )
    case 'email':
      return replyText(
        replyToken,
        `Data kamu sudah lengkap nih, Sekarang kamu sudah bisa submit issue / membuat request baru lewat official line kami. Ketik help untuk memulai`
      )
    default: 
      return replyText(
        replyToken,
        `Kamu sudah pernah terdaftar`
      )
  }
}

function handleText(message, replyToken, source) {
  const buttonsImageURL = `${baseURL}/static/buttons/1040.jpg`;

  switch (message.text.toLowerCase()) {
    case 'profile':
      if (source.userId) {
        return client.getProfile(source.userId)
          .then((profile) => replyText(
            replyToken,
            [
              `User Id: ${source.userId}`,
              `Display name: ${profile.displayName}`,
              `Status message: ${profile.statusMessage}`,
            ]
          ));
      } else {
        return replyText(replyToken, 'Bot can\'t use profile API without user ID');
      }
    case 'help':
      return client.replyMessage(
        replyToken,
        {
          type: 'template',
          altText: 'Help Template',
          template: {
            type: 'buttons',
            text: 'Silahkan Pilih Menu',
            actions: [
              { label: 'registrasi', type: 'message', text: 'registrasi' },
              { label: 'request', type: 'message', text: 'request' },
            ],
          },
        }
      )
    case 'registrasi':
      return replyText(
        replyToken,
        [
          'Silahkan isi nama kamu dengan format berikut, cth: ',
          'nama John Doe'
        ]
      )
    // case 'request':
    //   return replyText(
    //     replyToken,
    //     [
    //       'Silahkan isi kode organisi kamu, cth: ',
    //       'organization John Doe'
    //     ]
    //   )
    case 'norequest':
      return client.replyMessage(
        replyToken,
        {
          type: 'template',
          altText: 'Request Template',
          template: {
            type: 'buttons',
            text: 'Request Form Template',
            actions: [
              { label: 'Organization', type: 'message', text: 'cth: organization IU-ITD' },
              { label: 'Caller', type: 'message', text: 'cth: caller Rio Oktafianto' },
              { label: 'Status', type: 'message', text: 'cth: status New' },
              // { label: 'Title', type: 'message', text: 'cth: title Akses Printer' },
              // { label: 'Description', type: 'message', text: 'cth: description Akses printer baru' },
              // { label: 'Impact', type: 'message', text: 'cth: cth: department' },
              // { label: 'Urgency', type: 'message', text: 'cth: urgency low' },
            ],
          },
        }
      );
    default:
      console.log(`Echo message to ${replyToken}: ${message.text}`);
      return replyText(replyToken, "Maaf, aku gak paham. Aku tanya ke developernya dulu yaah");
  }
}

function handleImage(message, replyToken) {
  const downloadPath = path.join(__dirname, 'downloaded', `${message.id}.jpg`);
  const previewPath = path.join(__dirname, 'downloaded', `${message.id}-preview.jpg`);

  return downloadContent(message.id, downloadPath)
    .then((downloadPath) => {
      // ImageMagick is needed here to run 'convert'
      // Please consider about security and performance by yourself
      cp.execSync(`convert -resize 240x jpeg:${downloadPath} jpeg:${previewPath}`);

      return client.replyMessage(
        replyToken,
        {
          type: 'image',
          originalContentUrl: baseURL + '/downloaded/' + path.basename(downloadPath),
          previewImageUrl: baseURL + '/downloaded/' + path.basename(previewPath),
        }
      );
    });
}

function handleVideo(message, replyToken) {
  const downloadPath = path.join(__dirname, 'downloaded', `${message.id}.mp4`);
  const previewPath = path.join(__dirname, 'downloaded', `${message.id}-preview.jpg`);

  return downloadContent(message.id, downloadPath)
    .then((downloadPath) => {
      // FFmpeg and ImageMagick is needed here to run 'convert'
      // Please consider about security and performance by yourself
      cp.execSync(`convert mp4:${downloadPath}[0] jpeg:${previewPath}`);

      return client.replyMessage(
        replyToken,
        {
          type: 'video',
          originalContentUrl: baseURL + '/downloaded/' + path.basename(downloadPath),
          previewImageUrl: baseURL + '/downloaded/' + path.basename(previewPath),
        }
      );
    });
}

function handleAudio(message, replyToken) {
  const downloadPath = path.join(__dirname, 'downloaded', `${message.id}.m4a`);

  return downloadContent(message.id, downloadPath)
    .then((downloadPath) => {
      return client.replyMessage(
        replyToken,
        {
          type: 'audio',
          originalContentUrl: baseURL + '/downloaded/' + path.basename(downloadPath),
          duration: 1000,
        }
      );
    });
}

function downloadContent(messageId, downloadPath) {
  return client.getMessageContent(messageId)
    .then((stream) => new Promise((resolve, reject) => {
      const writable = fs.createWriteStream(downloadPath);
      stream.pipe(writable);
      stream.on('end', () => resolve(downloadPath));
      stream.on('error', reject);
    }));
}

function handleLocation(message, replyToken) {
  return client.replyMessage(
    replyToken,
    {
      type: 'location',
      title: message.title,
      address: message.address,
      latitude: message.latitude,
      longitude: message.longitude,
    }
  );
}

function handleSticker(message, replyToken) {
  return client.replyMessage(
    replyToken,
    {
      type: 'sticker',
      packageId: message.packageId,
      stickerId: message.stickerId,
    }
  );
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
