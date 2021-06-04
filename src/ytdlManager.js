const youtubedl = require("youtube-dl-exec");

const tryDownload = async (url, options) => {
  try {
    await youtubedl(url, options);
  } catch (e) {
    console.error("Unable to download video from ", url, e);
  }
};

module.exports = {
  tryDownload,
};
