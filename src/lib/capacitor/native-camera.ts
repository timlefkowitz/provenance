/**
 * Takes one photo with the native iOS camera (@capacitor/camera) and returns
 * it as a File, so forms can treat it exactly like an <input type="file">
 * pick. Resolves null when the user cancels.
 */
export async function takeNativePhoto(): Promise<File | null> {
  const { Camera, EncodingType } = await import('@capacitor/camera');
  let result;
  try {
    result = await Camera.takePhoto({
      quality: 90,
      correctOrientation: true,
      encodingType: EncodingType.JPEG,
      saveToGallery: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) return null;
    throw err;
  }
  if (!result.webPath) throw new Error('Camera returned no image');

  const blob = await (await fetch(result.webPath)).blob();
  const type = blob.type || 'image/jpeg';
  return new File([blob], `photo-${Date.now()}.jpg`, { type });
}
