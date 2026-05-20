const embeddedTemplateImageMaxBytes = 1_500_000;

export async function readTemplateImageFileAsDataUrl(file: File): Promise<string> {
  validateTemplateImageFile(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('The selected image could not be read.'));
    };

    reader.onerror = () => {
      reject(new Error('The selected image could not be read.'));
    };

    reader.readAsDataURL(file);
  });
}

export function deriveTemplateImageAltText(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function validateTemplateImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded here.');
  }

  if (file.size > embeddedTemplateImageMaxBytes) {
    throw new Error('Image uploads are limited to 1.5 MB for inline email embeds.');
  }
}
