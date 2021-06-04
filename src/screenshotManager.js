const puppeteer = require("puppeteer");
let browser;

const init = async () => {
  browser = await puppeteer.launch();
};

const shutdown = async () => {
  await browser.close();
};

const generateScreenshot = async (url, outputPath) => {
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  // attempt to click the "Yes I'm over 18" button, ignore if we don't find it
  try {
    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.click("button[name=over18][value=yes]"),
    ]);
  } catch (e) {}

  await page.pdf({ path: outputPath, format: "a4" });
  await page.close();
};

module.exports = {
  init,
  generateScreenshot,
  shutdown,
};
