import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function invite(page: Page) {
  await page.getByRole("button", {name: "Invite", exact: true}).click();
  const link = await page.getByRole("textbox", {name:"Room invite link"}).inputValue();
  await page.getByRole("button", {name:"Close invite"}).click();
  return link;
}
async function join(page: Page, link: string, name: string) {
  await page.goto(link);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", {name:"Join room", exact:true}).click();
  await expect(page.getByRole("navigation", {name:"Call controls"})).toBeVisible();
}
async function camera(page: Page, name: string) {
  return page.getByLabel(name + " camera", {exact:true}).evaluate((element: HTMLVideoElement) => element.videoWidth);
}

test("four people can join, use cameras, and change activities without leaving", async ({page, browser}, info) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext("2d")!;
      const interval = window.setInterval(() => {
        ctx.fillStyle = "#315440";
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = "white";
        ctx.fillText("Exam Crew", 130, 95);
      }, 60);
      const stream = canvas.captureStream(15);
      const track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => { clearInterval(interval); stop(); };
      return stream;
    };
  });
  await page.goto("/spaces");
  await expect(page.getByRole("heading", {level:1})).toHaveText(/A place to\s*show up\./);
  await page.getByLabel("Your name").fill("Alex");
  await page.getByLabel("Room name").fill("Exam Crew");
  await page.screenshot({path:info.outputPath("spaces-home.png"),fullPage:true,animations:"disabled"});
  await page.getByRole("button", {name:"Create room", exact:true}).click();
  const link = await invite(page);
  const context = await browser.newContext({permissions:["camera","microphone"],viewport:{width:390,height:844}});
  try {
    const [sam, noa, priya] = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
    await Promise.all([join(sam,link,"Sam"),join(noa,link,"Noa"),join(priya,link,"Priya")]);
    await expect(page.getByText("4 of 4 seats")).toBeVisible();
    await sam.getByRole("button", {name:"Camera",exact:true}).click();
    await expect.poll(() => camera(page,"Sam"),{timeout:15000}).toBeGreaterThan(0);
    await page.getByRole("button", {name:"Camera",exact:true}).click();
    for (const viewer of [sam,noa,priya]) await expect.poll(() => camera(viewer,"Alex"),{timeout:15000}).toBeGreaterThan(0);
    await noa.getByRole("button", {name:"Hand",exact:true}).click();
    await expect(page.locator(".hand-raised")).toContainText("Noa");
    await noa.getByLabel("Note type").selectOption("question");
    await noa.getByLabel("Write to the room board").fill("Why does the queue need a tie breaker?");
    await noa.getByRole("button",{name:"Save to room"}).click();
    await expect(page.getByText("Why does the queue need a tie breaker?")).toBeVisible();
    await page.getByRole("button", {name:"Mark resolved"}).click();
    await expect(sam.getByLabel("Resolved")).toBeVisible();
    await page.getByLabel("Room activity").selectOption("meet");
    await expect(priya.getByRole("heading", {name:"Meeting notes"})).toBeVisible();
    await expect.poll(() => camera(priya,"Alex"),{timeout:10000}).toBeGreaterThan(0);
    await page.getByRole("button", {name:"Share",exact:true}).click();
    await expect(sam.getByRole("heading", {name:"Presentation"})).toBeVisible();
    await expect.poll(() => sam.getByLabel("Screen shared by Alex").evaluate((video:HTMLVideoElement) => video.videoWidth),{timeout:12000}).toBeGreaterThan(0);
    await page.screenshot({path:info.outputPath("spaces-room.png"),fullPage:true,animations:"disabled"});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await context.close();
  }
});

test("movie night syncs across browsers and returns to saved moments", async ({page, browser}, info) => {
  await page.goto("/spaces");
  await page.getByRole("button", {name:/^Watch Press play/}).click();
  await page.getByLabel("Your name").fill("Mira");
  await page.getByLabel("Room name").fill("Friday Film");
  await page.getByRole("button", {name:"Create room",exact:true}).click();
  const link = await invite(page);
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await join(guest,link,"Jules");
    await page.getByRole("button", {name:"Load demo film"}).click();
    await page.getByRole("button", {name:"I’m ready"}).click();
    await guest.getByRole("button", {name:"I’m ready"}).click();
    await page.getByRole("button", {name:"Start together"}).click();
    await expect.poll(() => guest.getByLabel("Room video").evaluate((el: HTMLVideoElement) => el.currentTime),{timeout:9000}).toBeGreaterThan(0);
    await page.getByLabel("Write to the room board").fill("The opening shot");
    await page.getByRole("button", {name:"Pin moment"}).click();
    await expect(guest.getByText("The opening shot")).toBeVisible();
    await page.screenshot({path:info.outputPath("spaces-watch.png"),fullPage:true,animations:"disabled"});
    await guest.getByRole("button", {name:"Leave",exact:true}).click();
    await page.getByRole("button", {name:"Leave",exact:true}).click();
    await page.getByRole("button", {name:/Friday Film/}).click();
    await expect(page.getByText("The opening shot")).toBeVisible();
    await expect(page.getByLabel("Room activity")).toBeEnabled();
  } finally {
    await context.close();
  }
});
