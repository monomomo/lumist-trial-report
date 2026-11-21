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

function restartPrintImage(image) {
  const documentUrl = new URL(image.ownerDocument.baseURI);
  const retryId = String(Date.now());
  const retryUrl = (source) => {
    const url = new URL(source, documentUrl);
    if (url.origin === documentUrl.origin) url.searchParams.set('pdfRetry', retryId);
    return url.href;
  };
  const picture = image.closest('picture');
  picture?.querySelectorAll('source[data-print-src]').forEach((source) => {
    source.srcset = retryUrl(source.dataset.printSrc);
  });
  image.src = retryUrl(image.dataset.printSrc || image.src);
}

export async function waitForPrintImage(image, onRetry, { timeoutMs = 25000 } = {}) {
  // Let the browser select the new source after switching the report to print images.
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    await waitForImage(image, { timeoutMs });
  } catch {
    onRetry();
    restartPrintImage(image);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      await waitForImage(image, { timeoutMs });
    } catch (error) {
      error.imageLabel = image.alt.trim() || '报告图片';
      throw error;
    }
  }
}
