const express = require('express');
const axios = require('axios');
const path = require('path');
const serverless = require('serverless-http');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// IMPORTANT: Use '/' so it works as /api/watch (rewritten from /watch)
app.get('/', async (req, res) => {
  const { type, id } = req.query;
  let imdbId = null, seasonNumber = null, episodeNumber = null, subtitleUrl = null, title = 'Untitled';

  try {
    if (type === 'movie') {
      const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=1e2d76e7c45818ed61645cb647981e5c&language=en-US`);
      imdbId = tmdbRes.data.imdb_id;
      title = tmdbRes.data.title || tmdbRes.data.name || 'Untitled';
      if (imdbId) {
        subtitleUrl = `https://sub.wyzie.ru/search?id=${imdbId}&encoding=utf-8&format=srt&source=all`;
      }
    } else if (type === 'tv') {
      const parts = id.split('/');
      const seriesId = parts[0];
      if (parts.length === 3) {
        seasonNumber = parts[1];
        episodeNumber = parts[2];
      }
      const externalRes = await axios.get(`https://api.themoviedb.org/3/tv/${seriesId}/external_ids?api_key=1e2d76e7c45818ed61645cb647981e5c`);
      imdbId = externalRes.data.imdb_id;
      if (seasonNumber && episodeNumber) {
        const epRes = await axios.get(`https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=1e2d76e7c45818ed61645cb647981e5c&language=en-US`);
        const showRes = await axios.get(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=1e2d76e7c45818ed61645cb647981e5c&language=en-US`);
        title = `${showRes.data.name || 'Series'} - S${seasonNumber}E${episodeNumber}: ${epRes.data.name || 'Episode'}`;
      } else {
        const showRes = await axios.get(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=1e2d76e7c45818ed61645cb647981e5c&language=en-US`);
        title = showRes.data.name || 'Untitled';
      }
      if (imdbId && seasonNumber && episodeNumber) {
        subtitleUrl = `https://sub.wyzie.ru/search?id=${imdbId}&season=${seasonNumber}&episode=${episodeNumber}&encoding=utf-8&format=srt&source=all`;
      }
    }

    const encodedId = encodeURIComponent(id);
    const destination = `https://tom.autoembed.cc/api/getVideoSource?type=${type}&id=${encodedId}`;
    const passthroughUrl = `https://pass-through.arlen.icu/?destination=${encodeURIComponent(destination)}`;

    const response = await axios.get(passthroughUrl, {
      headers: {
        'x-origin': 'https://tom.autoembed.cc',
        'x-referer': 'https://tom.autoembed.cc'
      }
    });

    const videoUrl = response.data.videoSource;
    if (!videoUrl) return res.status(404).send('Video source not found.');

    res.render("player", {
      videoUrl,
      title,
      subtitleUrl
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Failed to fetch video source.');
  }
});

module.exports = serverless(app);
