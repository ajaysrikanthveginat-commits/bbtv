import { expect, test, type Locator } from '@playwright/test';

async function receivedFilmTone(player: Locator) {
  return player.evaluate(async (element: HTMLMediaElement) => {
    const stream = element.srcObject as MediaStream | null;
    if (!stream?.getAudioTracks().length || element.muted || element.paused) return false;
    const context = new AudioContext();
    try {
      await context.resume();
      const analyser = context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const target = Math.round(880 * analyser.fftSize / context.sampleRate);
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 60));
        analyser.getByteFrequencyData(bins);
        if (Math.max(...bins.slice(target - 1, target + 2)) > 140) return true;
      }
      return false;
    } finally { await context.close(); }
  });
}

for (const classic of [false, true]) {
  test((classic ? 'Classic' : 'Spaces') + ' plays shared tab sound independently of the microphone', async ({page, browser}) => {
    await page.addInitScript(() => {
      let shares = 0;
      navigator.mediaDevices.getDisplayMedia = async options => {
        if (!options?.audio) throw new Error('Display audio was not requested');
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 180;
        const paint = canvas.getContext('2d')!;
        const timer = setInterval(() => paint.fillRect(0, 0, 320, 180), 60);
        const stream = canvas.captureStream(15);
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); };
        if (++shares === 1) {
          const context = new AudioContext();
          await context.resume();
          const tone = context.createOscillator();
          tone.frequency.value = 880;
          const dest = context.createMediaStreamDestination();
          tone.connect(dest); tone.start();
          const audio = dest.stream.getAudioTracks()[0];
          const stopAudio = audio.stop.bind(audio);
          audio.stop = () => { tone.stop(); void context.close(); stopAudio(); };
          stream.addTrack(audio);
        }
        return stream;
      };
    });
    await page.goto(classic ? '/classic' : '/spaces');
    await page.getByLabel('Your name').fill('Alex');
    await page.getByLabel('Room name').fill('Sound check');
    await page.getByRole('button', {name: classic ? 'Start movie night' : 'Create room', exact:true}).click();
    await page.getByRole('button',{name:'Invite',exact:true}).click();
    const link = await page.getByRole('textbox', {name:classic ? 'Invitation link' : 'Room invite link'}).inputValue();
    await page.getByRole('button',{name:classic ? 'Close invitation' : 'Close invite'}).click();
    const share = page.getByRole('button', {name:'Share', exact:true});
    await share.click();
    const local = page.getByLabel(classic ? 'Shared screen' : 'Screen shared by Alex', {exact:true});
    await expect(local).toBeVisible();
    expect(await local.evaluate((v:HTMLVideoElement) => v.muted)).toBe(true);
    const context = await browser.newContext();
    try {
      const guest = await context.newPage();
      await guest.goto(link);
      await guest.getByLabel('Your name').fill('Sam');
      await guest.getByRole('button', {name:classic ? 'Join movie night' : 'Join room', exact:true}).click();
      const sound = guest.getByLabel(classic ? 'Shared screen' : 'Shared screen audio', {exact:true});
      await expect.poll(() => receivedFilmTone(sound), {timeout:15000}).toBe(true);
      await page.getByRole('button', {name:classic ? 'Voice only' : 'Mic',exact:true}).click();
      await page.getByRole('button', {name:'Mic',exact:true}).click();
      await expect.poll(() => receivedFilmTone(sound), {timeout:10000}).toBe(true);
      const stop = classic ? page.getByRole('button',{name:'Stop share',exact:true}) : share;
      await stop.click();
      await expect(sound).toHaveCount(0);
      await share.click();
      await expect(page.getByText(/To share sound, select/)).toBeVisible();
      const silent = guest.getByLabel(classic ? 'Shared screen' : 'Screen shared by Alex',{exact:true});
      await expect.poll(() => silent.evaluate((v:HTMLVideoElement) => v.videoWidth),{timeout:10000}).toBeGreaterThan(0);
      await expect(guest.getByText(/Video only/i)).toBeVisible();
    } finally { await context.close(); }
  });
}
