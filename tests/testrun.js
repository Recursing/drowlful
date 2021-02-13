//@ts-check
// ...
const { chromium } = require("playwright");

const URL = "https://buonanno.tech/drowlful";
const NUM_PLAYERS = 5;
(async () => {
  const browsers = await Promise.all(
    [...Array(NUM_PLAYERS)].map(async () => {
      return await chromium.launch({
        headless: false,
      });
    })
  );
  const contexts = await Promise.all(
    browsers.map(async (browser) => await browser.newContext())
  );

  const pages = await Promise.all(
    contexts.map(async (context) => await context.newPage())
  );

  await Promise.all(pages.map((page) => page.goto(URL)));

  for (let [i, page] of pages.entries()) {
    await page.fill('input[placeholder="username"]', `username${i}`);
    await page.fill('input[placeholder="Your prompt"]', `prompt${i}`);
    await page.click('text="Login"');
  }

  await new Promise((r) => setTimeout(r, 4000));

  await pages[0].click('text="Everybody in!"');

  await new Promise((r) => setTimeout(r, 2000));

  for (let page of pages) {
    const cx = 400,
      cy = 300;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy);
    await page.mouse.move(cx + 200, cy + 200);
    await page.mouse.move(cx, cy + 200);
    await page.mouse.move(cx, cy);
    await page.mouse.move(cx + 100, cy + 100);
    await page.mouse.move(cx + 100, cy + 400);
    await page.mouse.up();
    console.log("Done it!");
  }

  for (let page of pages) {
    page.on("dialog", async (dialog) => {
      console.log(dialog.message());
      await dialog.accept();
    });
  }
  await new Promise((r) => setTimeout(r, 4000));

  for (let page of pages) {
    await page.click('text="Done!"');
  }

  for (let i = 0; i < 6; i++) {
    console.log(`Round ${i}`);
    await new Promise((r) => setTimeout(r, 1000));

    for (let [i, page] of pages.entries()) {
      if ((await page.$('input[placeholder="Your guess"]')) !== null) {
        await page.fill('input[placeholder="Your guess"]', `Guess for ${i}`);
        await page.click('text="Send!"');
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
    for (let page of pages) {
      if ((await page.$('text="Send!"')) !== null) {
        await page.evaluate(() => {
          document.querySelector("select option:nth-child(2)").selected = true;
        });
        await page.click('text="Send!"');
      }
    }
    await new Promise((r) => setTimeout(r, 15000));
  }

  await new Promise((r) => setTimeout(r, 40000));

  for (let page of pages) {
    await page.close();
  }

  // ---------------------
  for (let context of contexts) {
    await context.close();
  }
  for (let browser of browsers) {
    await browser.close();
  }
})();
