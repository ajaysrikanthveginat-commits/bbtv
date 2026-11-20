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

test("the main address opens handwriting and each activity has its own room", async ({page,browser},info) => {
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toHaveText(/A place to\s*show up\./);
  await page.getByLabel("Your name").fill("Alex");
  await page.getByLabel("Room name").fill("Our room");
  await page.getByRole("button",{name:"Create room",exact:true}).click();
  await expect(page.locator(".activity-study")).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  const link = await invite(page);
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await join(guest,link,"Sam");
    await page.getByRole("button",{name:"Calligraphy pen",exact:true}).click();
    let paper = page.getByRole("img",{name:"Drawing surface",exact:true});
    await paper.scrollIntoViewIfNeeded();
    const rect = (await paper.boundingBox())!;
    await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.3);
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width*.65,rect.y+rect.height*.5,{steps:18});
    await page.mouse.up();
    await expect(guest.locator('path[data-pen="calligraphy"]')).toHaveCount(1);
    await page.screenshot({path:info.outputPath("study-room.png"),fullPage:true,animations:"disabled"});
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button",{name:"Download handwriting"}).click();
    expect((await downloaded).suggestedFilename()).toBe("BBTV-whiteboard.png");
    await page.getByLabel("Room activity").selectOption("meet");
    await expect(guest.locator(".activity-meet")).toBeVisible();
    await expect(page.locator("textarea")).toHaveCount(0);
    await expect(guest.locator('path[data-pen="calligraphy"]')).toHaveCount(1);
    await page.getByRole("button",{name:"Discussion",exact:true}).click();
    await expect(page.getByRole("img",{name:"Drawing surface",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"Whiteboard",exact:true}).click();
    await expect(page.locator('path[data-pen="calligraphy"]')).toHaveCount(1);
    await page.screenshot({path:info.outputPath("meeting-room.png"),fullPage:true,animations:"disabled"});
    await page.getByLabel("Room activity").selectOption("family");
    await expect(guest.locator(".activity-family")).toBeVisible();
    await expect(guest.getByRole("heading",{name:"Family chat"})).toBeVisible();
    await expect(page.getByRole("img",{name:"Drawing surface",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"Send ❤️ reaction"}).click();
    await expect(guest.locator(".family-reaction")).toContainText("Alex sent ❤️");
    await page.screenshot({path:info.outputPath("family-room.png"),fullPage:true,animations:"disabled"});
    await page.getByRole("button",{name:"Movie night",exact:true}).click();
    await expect(guest.locator(".activity-watch")).toBeVisible();
    await page.getByLabel("Room activity").selectOption("study");
    await expect(page.getByRole("img",{name:"Drawing surface",exact:true})).toBeVisible();
    await expect(page.locator('path[data-pen="calligraphy"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test("handwriting streams live, erases, undoes, and returns with the room", async ({page,browser},info) => {
  await page.goto("/spaces");
  await page.getByLabel("Your name").fill("Alex");
  await page.getByLabel("Room name").fill("Writing together");
  await page.getByRole("button",{name:"Create room",exact:true}).click();
  const link = await invite(page);
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await join(guest,link,"Sam");
    const paper = page.getByRole("img",{name:"Drawing surface",exact:true});
    await paper.scrollIntoViewIfNeeded();
    const bounds = (await paper.boundingBox())!;
    const x = bounds.x + bounds.width * .2;
    const y = bounds.y + bounds.height * .35;
    if (info.project.name === "mobile") {
      const touch = await page.context().newCDPSession(page);
      await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
      for (let step=1;step<=12;step++) await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+step*5,y:y+Math.sin(step)*10}]});
      await expect.poll(() => guest.locator("[data-stroke]").first().getAttribute("d")).toContain("L");
      await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await touch.detach();
    } else {
      await page.mouse.move(x,y);
      await page.mouse.down();
      await page.mouse.move(x+110,y+55,{steps:15});
      await expect.poll(() => guest.locator("[data-stroke]").first().getAttribute("d")).toContain("L");
      await page.mouse.up();
    }
    await expect(page.getByRole("button",{name:"Undo your last stroke"})).toBeEnabled();
    await expect(guest.locator("[data-stroke]")).toHaveCount(1);
    await page.screenshot({path:info.outputPath("spaces-handwriting.png"),fullPage:true,animations:"disabled"});
    await page.getByRole("button",{name:"Eraser",exact:true}).click();
    await page.mouse.move(x+20,y);
    await page.mouse.down();
    await page.mouse.move(x+50,y+20,{steps:6});
    await page.mouse.up();
    await expect(guest.locator('path[stroke="#fffef9"]')).toHaveCount(1);
    await page.getByRole("button",{name:"Undo your last stroke"}).click();
    await expect(guest.locator('path[stroke="#fffef9"]')).toHaveCount(0);
    await expect(guest.locator("[data-stroke]")).toHaveCount(1);
    await page.getByRole("button",{name:"Cameras",exact:true}).click();
    await expect(paper).toHaveCount(0);
    await page.getByRole("button",{name:"Whiteboard",exact:true}).click();
    await expect(page.locator("[data-stroke]")).toHaveCount(1);
    await page.getByLabel("Room activity").selectOption("meet");
    await expect(guest.getByRole("heading",{name:"People",exact:true})).toBeVisible();
    await expect(guest.locator("[data-stroke]")).toHaveCount(1);
    await guest.getByRole("button",{name:"Leave",exact:true}).click();
    await page.getByRole("button",{name:"Leave",exact:true}).click();
    await page.getByRole("button",{name:/Writing together/}).click();
    await expect(page.locator("[data-stroke]")).toHaveCount(1);
    page.once("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Clear whiteboard"}).click();
    await expect(page.locator("[data-stroke]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test("lounge typography and motion work at this screen size", async ({page}, info) => {
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/spaces");
  const photo = page.locator(".spaces-hero-photo img");
  await expect.poll(() => photo.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1320);
  const fonts = await page.evaluate(async () => {
    const display = await document.fonts.load('660 56px "Bricolage Grotesque"');
    const italic = await document.fonts.load('italic 500 56px "Cormorant Garamond"');
    return [display.length, italic.length];
  });
  expect(fonts).toEqual([1, 1]);
  await expect(page.locator(".hero-line > span")).toHaveCSS("animation-name", "hero-type-in");
  if (info.project.name === "desktop") {
    const hero = page.locator(".spaces-hero");
    await hero.hover({position:{x:185,y:118}});
    await expect.poll(() => hero.evaluate(element =>
      element.style.getPropertyValue("--pointer-x"))).not.toBe("");
    const study = page.getByRole("button", {name:/^Study/});
    await study.hover();
    await expect.poll(() => study.evaluate(element =>
      element.style.getPropertyValue("--pointer-x"))).not.toBe("");
    await expect.poll(() => hero.evaluate(element =>
      element.style.getPropertyValue("--pointer-x"))).toBe("");
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator(".hero-line > span")).toHaveCSS("animation-name", "none");
  await expect(photo).toHaveCSS("transform", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({path:info.outputPath("spaces-lounge.png"),fullPage:true});
  await page.getByRole("link", {name:"Open a room"}).click();
  await expect(page).toHaveURL(/#space-setup$/);
  await expect(page.getByRole("button", {name:/^Study/})).toBeInViewport();
});

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
    await expect(noa.locator("textarea")).toHaveCount(0);
    await expect(noa.getByRole("img",{name:"Drawing surface",exact:true})).toBeVisible();
    await page.getByLabel("Room activity").selectOption("meet");
    await expect(priya.getByRole("heading", {name:"People",exact:true})).toBeVisible();
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
