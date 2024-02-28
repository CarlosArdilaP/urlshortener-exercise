require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const validUrl = require('valid-url');
app.use(bodyParser.json());

app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));

app.use((req, res, next) => {
  console.log(`[${req.method}] request to ${req.url}`);

  if (Object.keys(req.body).length !== 0) {
    console.log('Request Payload:', req.body);
  }
  
  next();
});

app.use((req, res, next) => {
  const statusCode = res.statusCode;
  const headers = res.getHeaders();
  const responseData = res.locals.responseData || {};

  // Registra la información en la consola
  console.log(`RESPONSE: ${statusCode}`);
  console.log('Response Data:', responseData);
  next();
});


// Basic Configuration
const port = process.env.PORT || 3000;


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Conexión a MongoDB Atlas establecida exitosamente');
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB Atlas:', err);
  });


const urlSchema = new mongoose.Schema({
  original_url: {
    type: String,
    required: true
  },
  shortened_url: Number,
});

const UrlShortened = mongoose.model('UrlShortened', urlSchema);

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

function validateUrl(req, res, next) {
  console.log("[Middleware validateUrl] URL VALIDATION: " + req.body.url);

  const originalUrl = req.body.url;
  if (!originalUrl || !validUrl.isWebUri(originalUrl)) {
    console.log("[Middleware validateUrl] Invalid Url at web uri check")
    return res.json({ error: 'invalid url' });
  };

  next();
}


app.post('/api/shorturl', validateUrl, function(req, res) {
  console.log("[Function] Initiate url upload")
  const originalUrl = req.body.url;
  UrlShortened.findOne({ original_url: originalUrl }, (err, existingUrl) => {
    if (err) {
      console.error('[Function] Error al buscar la URL en la base de datos:', err);
      return res.json({ error: 'Error interno del servidor' });
    }
    if (existingUrl) {
      res.json({ original_url: existingUrl.original_url, short_url: existingUrl.shortened_url });
    } else {
      const shortenedUrl = Math.floor(Math.random() * 10000).toString();
      const newUrl = new UrlShortened({ original_url: originalUrl, shortened_url: shortenedUrl });
      newUrl.save((err, savedUrl) => {
        if (err) {
          console.error('[Function] Error al guardar la URL en la base de datos:', err);
          return res.json({ error: 'Error al guardar la URL en la base de datos' });
        }
        console.log('[Function] URL guardada correctamente:', savedUrl);
        return res.json({ original_url: savedUrl.original_url, short_url: savedUrl.shortened_url });
      });
    }
  });
});


app.get('/api/shorturl/:shortUrl', function(req, res) {
  const shortUrl = req.params.shortUrl;
  if (typeof shortUrl === 'undefined' || isNaN(shortUrl)) {
    return res.json({ error: 'Wrong format' });
  }else{
    UrlShortened.findOne({ shortened_url: shortUrl }, function(err, urlEntry) {
      if (err || !urlEntry) {
          return res.json({ error: 'No short URL found for the given input' });
      }
      return res.redirect(urlEntry.original_url);
    });
  }
  
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
