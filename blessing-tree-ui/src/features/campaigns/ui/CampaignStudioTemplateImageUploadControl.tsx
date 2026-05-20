import { useId, useState, type ChangeEvent } from 'react';
import {
  deriveTemplateImageAltText,
  readTemplateImageFileAsDataUrl,
} from '@/features/campaigns/model/campaignTemplateImageUpload';

interface CampaignStudioTemplateImageUploadControlProps {
  isSaving: boolean;
  onImageLoaded: (input: { src: string; suggestedAltText: string }) => void;
}

export function CampaignStudioTemplateImageUploadControl({
  isSaving,
  onImageLoaded,
}: CampaignStudioTemplateImageUploadControlProps) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    try {
      const src = await readTemplateImageFileAsDataUrl(file);
      onImageLoaded({
        src,
        suggestedAltText: deriveTemplateImageAltText(file.name),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="campaign-template-image-upload">
      <label
        htmlFor={inputId}
        className={`campaign-template-image-upload__button ${
          isSaving || isUploading ? 'is-disabled' : ''
        }`}
      >
        <i className="bi bi-upload" aria-hidden="true" />
        <span>{isUploading ? 'Uploading…' : 'Upload image'}</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="visually-hidden"
        disabled={isSaving || isUploading}
        onChange={handleFileChange}
      />
      <div className="campaign-template-image-upload__hint">
        Embeds the file into this template. Best for maps or small reference graphics.
      </div>
      {errorMessage ? (
        <div className="campaign-template-image-upload__error" role="status">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
