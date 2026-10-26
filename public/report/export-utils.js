export function waitForImage(image, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let decoding = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      if (error) reject(error);
      else resolve();
    };
    const failed = () => finish(new Error('EXPORT_IMAGES_FAILED'));
    const loaded = async () => {
      if (decoding || finished) return;
      decoding = true;
      if (!image.naturalWidth) return failed();
      try {
        if (image.decode) await image.decode();
        finish();
      } catch {
        failed();
      }
    };
    const timer = setTimeout(failed, timeoutMs);
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    if (image.complete) loaded();
  });
}
