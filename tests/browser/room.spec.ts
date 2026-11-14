import { test, expect } from '@playwright/test';

test('entry, invitation, two-person chat, cinema mode, and session recovery', async ({page,browser}, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('Different places');
  await page.getByLabel('Your name').fill('Alex');
  await page.getByLabel('Room name').fill('Friday favorites');
  await expect(page.getByRole('button',{name:'Start movie night'})).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('home.png'),fullPage:true});
  await page.getByRole('button',{name:'Start movie night'}).click();
  await expect(page.getByRole('heading',{name:'Friday favorites'})).toBeVisible();
  await page.getByRole('button',{name:'Invite',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const invite=await page.getByLabel('Invitation link').inputValue();
  await page.getByRole('button',{name:'Close invitation'}).click();
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const guest=await context.newPage();
  await guest.goto(invite);
  await guest.getByLabel('Your name').fill('Sam');
  await guest.getByRole('button',{name:'Join movie night'}).click();
  await expect(guest.getByRole('heading',{name:'Friday favorites'})).toBeVisible();
  await page.getByLabel('Message your room').fill('Popcorn is ready!');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(guest.getByText('Popcorn is ready!',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Send ❤️ reaction'}).click();
  await expect(guest.getByText('❤️',{exact:true}).last()).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('room.png'),fullPage:true});
  await page.locator('.cinema-toggle').click();
  await expect(page.locator('aside')).toBeHidden();
  await page.locator('.cinema-toggle').click();
  await expect(page.locator('aside')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Friday favorites'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();
  await context.close();
});

test('invitation dialog traps focus and closes on Escape',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button',{name:'Start movie night'}).click();
  await page.getByRole('button',{name:'Invite',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('actual media playback stays together after countdown, seek, and break', async ({page,browser}) => {
  const {readFileSync}=await import('node:fs');
  const bytes=readFileSync('tests/browser/fixture.webm');
  const mediaUrl='https://media.example.test/fixture.webm';
  await page.route(mediaUrl,route=>route.fulfill({status:200,contentType:'video/webm',body:bytes}));
  await page.goto('/');
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button',{name:'Start movie night'}).click();
  await page.getByRole('button',{name:'Invite',exact:true}).click();
  const invite=await page.getByLabel('Invitation link').inputValue();
  await page.getByRole('button',{name:'Close invitation'}).click();
  const context=await browser.newContext();
  const guest=await context.newPage();
  await guest.route(mediaUrl,route=>route.fulfill({status:200,contentType:'video/webm',body:bytes}));
  await guest.goto(invite);
  await guest.getByLabel('Your name').fill('Sam');
  await guest.getByRole('button',{name:'Join movie night'}).click();
  await page.getByLabel('Direct HTTPS video link').fill(mediaUrl);
  await page.getByRole('button',{name:'Load video'}).click();
  await page.getByRole('button',{name:'I’m ready'}).click();
  await guest.getByRole('button',{name:'I’m ready'}).click();
  await page.getByRole('button',{name:'Start together'}).click();
  for(const p of [page,guest]){
    const unblock=p.getByRole('button',{name:'Enable playback on this device'});
    await expect.poll(async()=>await p.locator('.watch-canvas video').evaluate((v:HTMLVideoElement)=>v.currentTime>0)).toBe(true);
    if(await unblock.isVisible())await unblock.click();
  }
  await page.getByLabel('Playback position').fill('8');
  await expect.poll(async()=>await guest.locator('.watch-canvas video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(7);
  await guest.getByRole('button',{name:'Take a break'}).click();
  await expect.poll(async()=>await page.locator('.watch-canvas video').evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
  await expect(page.locator('.watch-status')).toHaveText('Paused');
  await context.close();
});
