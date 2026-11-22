// Browsers may return video alone when the selected source has no audio.
export function captureDisplay(video: MediaTrackConstraints = {}) {
  const options = {
    video: { displaySurface: "browser", ...video },
    audio: true,
    selfBrowserSurface: "exclude",
    systemAudio: "include",
  };
  return navigator.mediaDevices.getDisplayMedia(options);
}

export const screenSoundHint = "To share sound, select the video’s browser tab and turn on tab audio in the share picker.";
