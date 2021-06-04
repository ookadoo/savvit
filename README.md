# savvit - The Reddit offline saver

## What this does

Once you configure and run the server, it will periodically check your Reddit "saved" items and attempt to do the following.

- Save information on each item in JSON format
- Take a snapshot of the comments page link
- If there is a video, download that

## Requirements

- python 2 (youtube-dl dependency)
- ffmpeg (if you want audio in the downloaded videos)

## Getting started

- Clone this repository
- `npm i` to install dependencies
- `cp config-example.json config.json`
- Edit config file with details from Reddit app preferences
  - Get auth details from [Reddit app preferences](https://www.reddit.com/prefs/apps)
- Run the processor with `npm start`

## Roadmap

- Saving image posts
- Unit tests
