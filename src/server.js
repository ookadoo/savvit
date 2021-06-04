// 3rd party libs
const snoowrap = require("snoowrap");
const get = require("get-value");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const colors = require("colors");

// custom libs
const config = require("../config.json");
const ssm = require("./screenshotManager");
const { tryDownload: ytdlDownload } = require("./ytdlManager");

// module vars
let running = false;

/**
 * Ensures the path is available to save files in
 * @param {string} path Path to prepare
 */
const preparePath = async (path) => {
  await fs.promises.mkdir(path, { recursive: true });
};

/**
 * Handle writing strigified object to disk
 * @param {string} exportPath Path to export JSON to
 * @param {string} exportFileName Filename for exported JSON file
 * @param {object} exportObject Object to JSON.stringify()
 */
const exportJson = async (exportPath, exportFileName, exportObject) => {
  await preparePath(exportPath);
  fs.writeFileSync(
    path.join(exportPath, exportFileName),
    JSON.stringify(exportObject, null, 2)
  );
};

/**
 * Saves the saved item to a save directory
 * @param {object} c Current saved item
 */
const saveInfo = async (c) => {
  await exportJson(c.targetPath, "info.json", c);
};

/**
 * Takes the state and saves it to the output directory configured
 * @param {object} state The state to save
 */
const saveState = async (state) => {
  await exportJson(config.outputPath, "state.json", state);
};

/**
 * Navigates to the oldRedditUrl and takes a screenshot to PDF
 * @param {object} c Current saved item
 */
const saveScreenshot = async (c) => {
  const url = c.oldRedditUrl;
  const snapshotFilename = `snapshot_${dayjs().format("YYYYMMDDHHmmss")}.pdf`;
  await ssm.generateScreenshot(url, path.join(c.targetPath, snapshotFilename));
};

/**
 * Sets reused values on the saved item object
 * @param {object} c Current saved item
 */
const prepareItem = async (c) => {
  const sr = (await c.subreddit).display_name;
  const createdReadable = dayjs.unix(c.created).format("YYYYMMDD");

  c.oldRedditUrl = `${config.urlPrefix}${c.permalink}`;
  c.isSubmission = c instanceof snoowrap.objects.Submission;
  c.desc = c.permalink.split("/")[5];
  c.targetPath = path.join(
    config.outputPath,
    sr,
    `${createdReadable}_${c.created}_${c.desc}`
  );
};

/**
 * Processes each item in the saved list, updating state where necessary
 * Returns array of lists for reporting
 * @param {object} saved Saved items object from snoowrap
 * @param {object} state State object saved to JSON
 * @returns array
 */
const processSavedItems = async (saved, state) => {
  let downloadVideoList = [];
  let otherList = [];
  let skipList = [];

  for (c of saved) {
    try {
      // skip those we've already processed
      if (state.processedList.map((i) => i.id).includes(c.id)) {
        skipList.push(c.id);
        continue;
      }

      // set properties for later
      await prepareItem(c);
      const downloadVideoUrl = get(
        c,
        "secure_media.reddit_video.fallback_url",
        ""
      );

      // separate the wheat from the chaff
      if (downloadVideoUrl.length > 0) {
        downloadVideoList.push({ ...c, downloadVideoUrl });
      } else {
        otherList.push(c);
      }

      // export saved item to json
      await saveInfo(c);

      // start a new page and save snapshot
      await saveScreenshot(c);

      // if we get here, we've processed the item
      state.processedList.push({ id: c.id, oldRedditUrl: c.oldRedditUrl });
    } catch (e) {
      // if we get here, give up and add to list as processed with the error message so we don't keep trying
      state.processedList.push({ id: c.id, error: e });
    }
  }

  return [downloadVideoList, otherList, skipList];
};

/**
 * Main function
 */
const main = async () => {
  const start = dayjs();
  let successfulVideoDownloads = 0;

  // start puppeteer browser instance
  await ssm.init();

  // connect with reddit and grab saved items
  const r = new snoowrap(config.auth);
  const saved = await await r
    .getUser(config.auth.username)
    .getSavedContent({ limit: config.limit });

  // initialize state
  let state = {
    processedList: [],
  };

  // try to grab state from disk
  try {
    state = require(path.join(process.cwd(), config.outputPath, "state.json"));
  } catch (e) {
    console.warn("Could not find state.json, starting with default");
  } finally {
    state.lastRun = new Date().toISOString();
  }

  const [downloadVideoList, otherList, skipList] = await processSavedItems(
    saved,
    state
  );

  await saveState(state);

  await ssm.shutdown();

  if (downloadVideoList.length > 0) {
    for (c of downloadVideoList) {
      try {
        await ytdlDownload(c.oldRedditUrl, {
          o: `${path.join(process.cwd(), c.targetPath, "%(title)s.%(ext)s")}`,
        });
        successfulVideoDownloads++;
      } catch (e) {
        console.error("ytdl error: ", e);
      }
    }
  }

  const end = dayjs();
  const elapsed = `${end.diff(start) / 1000}s`;
  console.log(
    `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`.gray,
    "Total:" + saved.length.toString().yellow,
    "Processed:" +
      (downloadVideoList.length + otherList.length).toString().yellow,
    "Vids/Successful:" +
      `${downloadVideoList.length.toString().yellow}/${
        successfulVideoDownloads.toString().green
      }`,
    "Elapsed:" + elapsed.cyan
  );
};

const intervalHandler = async () => {
  if (!running) {
    running = true;

    try {
      await main();
    } catch (e) {
      console.log(e);
    } finally {
      running = false;
    }
  }
};

intervalHandler();
setInterval(intervalHandler, config.intervalMs);
