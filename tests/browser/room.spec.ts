import { test, expect } from '@playwright/test';

test('entry, invitation, two-person chat, cinema mode, and session recovery', async ({page,browser}, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('The shared');
  await page.getByRole('button', {name: 'Play the preview'}).click();
  await expect(page.getByRole('dialog', {name: 'BBTV preview'})).toBeVisible();
  await expect.poll(() => page.locator("dialog[aria-label='BBTV preview'] video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', {name: 'Close preview'}).click();
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
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera','microphone']});
  const guest=await context.newPage();
  await guest.goto(invite);
  await guest.getByLabel('Your name').fill('Sam');
  await guest.getByRole('button',{name:'Join movie night'}).click();
  await expect(guest.getByRole('heading',{name:'Friday favorites'})).toBeVisible();
  await page.getByLabel('Message your room').fill('Popcorn is ready!');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(guest.getByText('Popcorn is ready!',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Send ❤️ reaction'}).click();
  await expect(guest.locator('.stage-reaction')).toHaveText('❤️');
  await guest.getByRole('button', {name: /^Up next/}).click();
  await guest.getByLabel('Video title').fill('Next feature');
  await guest.getByLabel('Video URL').fill('https://media.example.test/feature.mp4');
  await guest.getByRole('button', {name: 'Add to queue'}).click();
  await page.getByRole('button', {name: /^Up next/}).click();
  await expect(page.getByText('Next feature', {exact: true})).toBeVisible();
  await guest.getByRole('button', {name: 'Vote for Next feature'}).click();
  await expect(page.getByRole('button', {name: 'Vote for Next feature'})).toHaveText('1');
  await expect(guest.getByRole('button', {name: 'Remove Next feature'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Remove Next feature'}).click();
  await expect(guest.getByText('Next feature', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Setup', exact:true}).click();

  const light = page.getByRole('button', {name: 'Ambient light'});
  await expect(light).toHaveAttribute('aria-pressed', 'true');
  await light.click();
  await expect(page.locator('.watch-player')).not.toHaveClass(/ambient-on/);
  await light.click();
  await page.screenshot({path:testInfo.outputPath('room.png'),fullPage:true});
  await page.locator('.cinema-toggle').click();
  await expect(page.locator('aside')).toBeHidden();
  await page.locator('.cinema-toggle').click();
  await expect(page.locator('aside')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  // The guest enables video first. The host must see it without sharing a camera.
  await guest.getByRole('button',{name:'Enable call',exact:true}).click();
  const guestFeed = page.locator('.call-tile').first().locator('video');
  await expect(guestFeed).not.toHaveClass(/call-video-hidden/, {timeout:15000});
  await expect.poll(()=>guestFeed.evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Voice only',exact:true}).click();
  await expect(page.getByRole('button',{name:'Camera',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Camera',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const participant of [page,guest]) {
    await expect.poll(()=>participant.locator('.call-tile').first().locator('video').evaluate((v:HTMLVideoElement)=>v.videoWidth),{timeout:15000}).toBeGreaterThan(0);
  }
  await page.getByRole('button',{name:'Camera',exact:true}).click();
  await page.getByRole('button',{name:'Camera',exact:true}).click();
  await expect.poll(()=>page.locator('.call-tile').last().locator('video').evaluate((v:HTMLVideoElement)=>!!v.srcObject && v.videoWidth>0)).toBe(true);
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
  await page.goto('/');
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button',{name:'Start movie night'}).click();
  await page.getByRole('button',{name:'Invite',exact:true}).click();
  const invite=await page.getByLabel('Invitation link').inputValue();
  await page.getByRole('button',{name:'Close invitation'}).click();
  const context=await browser.newContext();
  const guest=await context.newPage();
  await guest.goto(invite);
  await guest.getByLabel('Your name').fill('Sam');
  await guest.getByRole('button',{name:'Join movie night'}).click();
  await page.getByRole('button',{name:'Try the watch preview'}).click();
  await page.getByRole('button',{name:'I’m ready'}).click();
  await guest.getByRole('button',{name:'I’m ready'}).click();
  await page.getByRole('button',{name:'Start together'}).click();
  for(const p of [page,guest]){
    const unblock=p.getByRole('button',{name:'Enable playback on this device'});
    if(await unblock.isVisible())await unblock.click();
    await expect.poll(async()=>await p.locator('.watch-canvas video').evaluate((v:HTMLVideoElement)=>v.currentTime>0)).toBe(true);
  }
  await guest.getByRole('button', {name: 'Setup', exact:true}).click();
  await guest.getByRole('button',{name:'1-minute intermission'}).click();
  await expect(page.locator('.intermission-card')).toContainText('Intermission');
  await expect(page.locator('.watch-status')).toHaveText('Paused');
  await guest.getByRole('button', {name: /^Moments/}).click();
  await guest.getByLabel('Moment name').fill('Opening shot');
  await guest.getByRole('button', {name: /^Pin /}).click();
  await expect(page.getByRole('button', {name: 'Jump to Opening shot'})).toBeVisible();
  const timeline = page.getByLabel('Playback position');
  const bounds = await timeline.boundingBox();
  if (!bounds) throw new Error('Playback timeline is not visible');
  await timeline.click({position:{x:bounds.width * 0.45,y:bounds.height / 2}});
  await expect.poll(()=>guest.locator('.watch-canvas video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(7);
  await expect.poll(()=>guest.locator('.watch-canvas video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeLessThan(11);
  await expect.poll(async()=>await page.locator('.watch-canvas video').evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
  await expect(page.locator('.watch-status')).toHaveText('Paused');
  await context.close();
});
